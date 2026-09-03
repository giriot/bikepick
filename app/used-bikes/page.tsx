import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { db } from '@/lib/db';
import { listUsedBikes, type UsedBikeFilters } from '@/lib/queries';
import { inr, relative, titleCase } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Empty, Notice, Pagination, TrustBadge } from '@/components/ui';
import { UsedFilters } from '@/components/UsedFilters';
import { SortSelect } from '@/components/Filters';
import { AdSlot } from '@/components/AdSlot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Used Bikes for Sale in India — Verified Listings with Trust Scores',
  description:
    'Browse approved used two-wheeler listings with a trust score built only from checks we actually performed: seller identity, RC, insurance, service history and inspection.',
  path: '/used-bikes',
  keywords: ['used bikes', 'second hand bike', 'used scooter india', 'verified used bike'],
});

const SORTS: [string, string][] = [
  ['newest', 'Newest first'], ['price_low', 'Price: low to high'], ['price_high', 'Price: high to low'],
  ['km_low', 'Lowest kilometres'], ['trust', 'Most trusted'], ['best_value', 'Best value'],
];

export default async function UsedBikesPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const f: UsedBikeFilters = {
    q: searchParams.q, brand: searchParams.brand, city: searchParams.city,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    minYear: searchParams.minYear ? Number(searchParams.minYear) : undefined,
    maxKm: searchParams.maxKm ? Number(searchParams.maxKm) : undefined,
    owners: searchParams.owners ? Number(searchParams.owners) : undefined,
    fuel: searchParams.fuel, abs: searchParams.abs === '1', condition: searchParams.condition,
    sellerType: searchParams.sellerType, verifiedOnly: searchParams.verified === '1',
    minTrust: searchParams.minTrust ? Number(searchParams.minTrust) : undefined,
    sort: (searchParams.sort as UsedBikeFilters['sort']) || 'newest',
    page: searchParams.page ? Number(searchParams.page) : 1,
    perPage: 12,
  };

  const [result, brands, cities] = await Promise.all([
    listUsedBikes(f),
    db.all<any>("SELECT DISTINCT brand_name FROM used_bikes WHERE status='approved' ORDER BY brand_name"),
    db.all<any>("SELECT DISTINCT city FROM used_bikes WHERE status='approved' ORDER BY city"),
  ]);

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (v && k !== 'page') qs.set(k, v);
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Used bikes', url: '/used-bikes' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Used bikes</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-mute">
            Only approved listings appear here. The trust score reflects the checks that were actually completed — it is
            not a mechanical warranty.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Suspense fallback={null}><SortSelect options={SORTS} /></Suspense>
          <Link href="/used-bikes/sell" className="btn-accent btn-sm">Sell your bike</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[268px_1fr]">
        <Suspense fallback={<div className="skeleton h-96" />}>
          <UsedFilters brands={brands.map((b) => b.brand_name)} cities={cities.map((c) => c.city)} />
        </Suspense>

        <div>
          <p className="mb-4 text-[13px] text-ink-mute" aria-live="polite">
            <strong className="font-semibold text-ink">{result.total}</strong> approved listing{result.total === 1 ? '' : 's'}
          </p>

          {result.items.length === 0 ? (
            <Empty title="No listings match these filters" body="Try widening your budget or clearing a filter. New listings appear here as soon as they pass verification." action={<Link href="/used-bikes" className="btn-primary btn-sm mt-2">Clear filters</Link>} />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((u: any) => (
                  <article key={u.id} className="card card-hover flex flex-col overflow-hidden">
                    <Link href={`/used-bikes/${u.slug}`} className="product-stage aspect-[8/5]">
                      <Image src={u.image_url || '/media/used.svg'} alt={`${u.brand_name} ${u.model_name}`} width={420} height={262} loading="lazy" className="h-full w-full object-contain" />
                      <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                        {u.price_verdict === 'good_deal' && <span className="badge bg-accent text-white">Good deal</span>}
                        {u.featured === 1 && <span className="badge bg-ink text-white">Featured</span>}
                        {u.is_demo === 1 && <span className="badge-demo">Demo</span>}
                      </div>
                    </Link>
                    <div className="flex flex-1 flex-col p-4">
                      <h2 className="text-[15px] font-semibold leading-snug">
                        <Link href={`/used-bikes/${u.slug}`} className="hover:text-brand-600">{u.brand_name} {u.model_name}</Link>
                      </h2>
                      <p className="mt-0.5 text-[12px] text-ink-mute">
                        {u.manufacture_year} · {Number(u.km_driven).toLocaleString('en-IN')} km · {u.owners} owner{u.owners > 1 ? 's' : ''} · {u.city}
                      </p>
                      <p className="mt-2 text-[18px] font-bold tracking-[-0.02em]">{inr(u.asking_price)}</p>
                      {u.estimated_price_min && (
                        <p className="text-[11.5px] text-ink-mute">Our estimate: {inr(u.estimated_price_min)}–{inr(u.estimated_price_max)}</p>
                      )}
                      <div className="mt-3"><TrustBadge band={u.trust_band} score={u.trust_score} /></div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                        <span className="text-[11px] uppercase tracking-wide text-ink-mute">{titleCase(u.seller_type)} · {relative(u.approved_at)}</span>
                        <Link href={`/used-bikes/${u.slug}`} className="btn-outline btn-sm">View</Link>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <Pagination page={result.page} pages={result.pages} base={`/used-bikes${qs.toString() ? `?${qs}` : ''}`} />
            </>
          )}

          <div className="mt-8">
            <Notice tone="warn" title="What verification means">
              A trust score reflects only the checks that were actually performed and recorded by our team. Mechanical
              condition is never guaranteed unless a physical inspection was completed and is shown on the listing.
              Always inspect the vehicle and verify documents yourself before paying.
            </Notice>
          </div>

          <AdSlot slotKey="used_list_inline" className="mt-8" />
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { db, nowIso } from '@/lib/db';
import { inr, dateIn } from '@/lib/format';
import { Breadcrumbs, Empty, Notice } from '@/components/ui';
import { LeadDialog } from '@/components/LeadDialog';
import { AdSlot } from '@/components/AdSlot';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata = buildMetadata({
  title: 'Dealer Offers & Discounts on New Two-Wheelers',
  description: 'Current offers submitted by verified dealers — cash discounts, exchange bonuses and finance deals. Every offer is approved by our team and expires automatically.',
  path: '/dealer-offers',
});

export default async function DealerOffersPage({ searchParams }: { searchParams: { city?: string; brand?: string } }) {
  const today = nowIso().slice(0, 10);
  const conditions = [
    "o.status = 'approved'", 'o.deleted_at IS NULL',
    "(o.start_date IS NULL OR o.start_date <= ?)", "(o.end_date IS NULL OR o.end_date >= ?)",
    "d.status = 'verified'",
  ];
  const args: any[] = [today, today];
  if (searchParams.city) { conditions.push('LOWER(o.city) = LOWER(?)'); args.push(searchParams.city); }
  if (searchParams.brand) { conditions.push('b.slug = ?'); args.push(searchParams.brand); }

  const [offers, cities, brands] = await Promise.all([
    db.all<any>(
      `SELECT o.*, d.business_name, d.city AS dealer_city, d.phone AS dealer_phone, d.featured AS dealer_featured,
              p.name AS product_name, p.slug AS product_slug, p.fuel_type, p.price_min,
              b.name AS brand_name, b.slug AS brand_slug
         FROM dealer_offers o
         JOIN dealer_profiles d ON d.id = o.dealer_id
         JOIN products p ON p.id = o.product_id
         JOIN brands b ON b.id = p.brand_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY o.featured DESC, o.discount DESC, o.created_at DESC`,
      args,
    ),
    db.all<any>("SELECT DISTINCT city FROM dealer_offers WHERE status='approved' AND deleted_at IS NULL ORDER BY city"),
    db.all<any>(`SELECT DISTINCT b.name, b.slug FROM dealer_offers o JOIN products p ON p.id=o.product_id JOIN brands b ON b.id=p.brand_id WHERE o.status='approved' AND o.deleted_at IS NULL ORDER BY b.name`),
  ]);

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Dealer offers', url: '/dealer-offers' }];

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <Breadcrumbs items={crumbs} />

      <header className="mt-4 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Dealer offers</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink-mute">
          Offers are submitted by verified dealers, approved by our team, and expire automatically on their end date.
          They are the dealer&apos;s commitment — confirm the final on-road figure before you pay anything.
        </p>
      </header>

      <div className="mt-4">
        <Notice tone="info" title="How to read these">
          A “discount” is what the dealer says they will take off. Ask for it in writing on the proforma invoice, and check
          whether it needs a specific finance or exchange to apply.
        </Notice>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/dealer-offers" className={`chip ${!searchParams.city && !searchParams.brand ? 'chip-active' : ''}`}>All offers</Link>
        {cities.map((c) => (
          <Link key={c.city} href={`/dealer-offers?city=${encodeURIComponent(c.city)}`} className={`chip ${searchParams.city === c.city ? 'chip-active' : ''}`}>{c.city}</Link>
        ))}
        {brands.map((b) => (
          <Link key={b.slug} href={`/dealer-offers?brand=${b.slug}`} className={`chip ${searchParams.brand === b.slug ? 'chip-active' : ''}`}>{b.name}</Link>
        ))}
      </div>

      {offers.length === 0 ? (
        <div className="mt-6">
          <Empty title="No live offers right now"
            body="Offers expire automatically when their end date passes, so this page never shows a stale deal. Check back, or ask a dealer directly for their best price."
            action={<Link href="/bikes" className="btn-primary btn-sm">Browse bikes</Link>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((o) => {
            const total = (o.discount || 0) + (o.exchange_bonus || 0);
            return (
              <article key={o.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/${o.fuel_type === 'electric' ? 'electric' : 'bikes'}/${o.brand_slug}/${o.product_slug}`}
                      className="text-[15px] font-semibold leading-5 hover:text-brand-700">{o.brand_name} {o.product_name}</Link>
                    <p className="mt-0.5 text-[12px] text-ink-mute">{o.city}</p>
                  </div>
                  {o.featured ? <span className="badge-sponsored">Sponsored</span> : null}
                </div>

                {total > 0 && (
                  <p className="mt-3 text-[24px] font-bold leading-none tracking-[-0.03em] text-brand-700">
                    Save up to {inr(total)}
                  </p>
                )}
                <p className="mt-2 text-[13px] leading-6 text-ink-soft">{o.offer_text}</p>

                <dl className="mt-3 space-y-1 text-[12.5px]">
                  {o.discount > 0 && <div className="flex justify-between"><dt className="text-ink-mute">Cash discount</dt><dd className="font-medium">{inr(o.discount)}</dd></div>}
                  {o.exchange_bonus > 0 && <div className="flex justify-between"><dt className="text-ink-mute">Exchange bonus</dt><dd className="font-medium">{inr(o.exchange_bonus)}</dd></div>}
                  {o.on_road > 0 && <div className="flex justify-between"><dt className="text-ink-mute">Quoted on-road</dt><dd className="font-medium">{inr(o.on_road)}</dd></div>}
                  {o.finance_offer && <div className="flex justify-between gap-3"><dt className="text-ink-mute">Finance</dt><dd className="text-right font-medium">{o.finance_offer}</dd></div>}
                  {o.accessories_offer && <div className="flex justify-between gap-3"><dt className="text-ink-mute">Accessories</dt><dd className="text-right font-medium">{o.accessories_offer}</dd></div>}
                </dl>

                <div className="mt-auto pt-4">
                  <p className="text-[11.5px] text-ink-mute">
                    {o.business_name}{o.end_date ? ` · valid till ${dateIn(o.end_date)}` : ''}
                  </p>
                  <div className="mt-2">
                    <LeadDialog
                      leadType="request_offer"
                      label="Claim this offer"
                      title={`Claim: ${o.brand_name} ${o.product_name}`}
                      description="We send your details to this dealer so they can confirm availability and the final on-road price."
                      productId={o.product_id} dealerId={o.dealer_id} offerId={o.id} city={o.city}
                      source="dealer-offers"
                      className="btn-primary btn-sm w-full"
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-8"><AdSlot slotKey="home_mid" /></div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="text-[16px] font-semibold">Are you a dealer?</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-6 text-ink-mute">
          List your offers, receive buyer enquiries directly and track them in a dashboard. Registration is free and every
          dealership is verified before it goes live.
        </p>
        <Link href="/dealer/register" className="btn-dark btn-sm mt-3">Register your dealership</Link>
      </section>
    </div>
  );
}

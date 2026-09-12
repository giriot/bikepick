import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCompareEntities, listProducts } from '@/lib/queries';
import { DEFAULT_WEIGHTS, type ScoreWeights } from '@/lib/score';
import { getJsonSetting } from '@/lib/settings';
import { inr, parseProductIds } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Empty, Notice, SectionHeader } from '@/components/ui';
import { CompareToggle } from '@/components/CompareToggle';
import { QuickCompare } from '@/components/QuickCompare';
import { ComparisonView } from '@/components/ComparisonView';
import { AdSlot } from '@/components/AdSlot';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const metadata = buildMetadata({
  title: 'Compare Bikes & Electric Scooters Side by Side',
  description:
    'Compare up to four two-wheelers on price, engine, battery, range, safety, features, running cost and warranty. Winners are chosen per attribute — lower price and lower weight win, not just the biggest number.',
  path: '/compare',
});

export default async function ComparePage({ searchParams }: { searchParams: { ids?: string } }) {
  const ids = (searchParams.ids || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  const entities = ids.length ? await getCompareEntities(ids) : [];
  const weights = await getJsonSetting<ScoreWeights>('score_weights', DEFAULT_WEIGHTS);
  const picker = (await listProducts({ sort: 'popular', perPage: 40 })).items.map((p) => ({
    id: p.id,
    label: `${p.brand_name} ${p.name}`,
    price: p.price_min,
  }));

  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Compare', url: '/compare' }];

  if (entities.length < 2) {
    const [popular, saved] = await Promise.all([
      listProducts({ sort: 'popular', perPage: 8 }),
      db.all<any>('SELECT id, slug, title, product_ids FROM comparisons ORDER BY featured DESC, view_count DESC LIMIT 8'),
    ]);
    return (
      <div className="container-xl py-6">
        <JsonLd data={breadcrumbJsonLd(crumbs)} />
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">Compare two-wheelers</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-mute">
          Pick 2 to 4 models. We compare every recorded attribute and flag the best value in each row using the correct
          direction — cheaper price, lower kerb weight and shorter charging time all count as wins.
        </p>

        {entities.length === 1 && (
          <div className="mt-5"><Notice tone="info">Add at least one more model to start the comparison.</Notice></div>
        )}

        <div className="mt-6"><QuickCompare products={picker} /></div>

        <section className="mt-8">
          <SectionHeader title="Popular comparisons" subtitle="Ready-made comparisons from our editorial team." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {saved.map((c) => {
              const pids = parseProductIds(c.product_ids);
              if (pids.length < 2) return null;
              return (
                <Link key={c.id} href={c.slug ? `/compare/${c.slug}` : `/compare?ids=${pids.join(',')}`} className="card card-hover p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{pids.length}-way</p>
                  <p className="mt-1 text-[13.5px] font-semibold leading-snug">{c.title}</p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <SectionHeader title="Add models to compare" subtitle="Tap Compare on any model — your selection follows you across the site." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {popular.items.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <Image src={p.image_url || '/media/commuter.svg'} alt="" width={64} height={40} className="h-10 w-16 object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{p.brand_name} {p.name}</p>
                  <p className="text-[11.5px] text-ink-mute">{inr(p.price_min)}</p>
                </div>
                <CompareToggle productId={p.id} label={`${p.brand_name} ${p.name}`} />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const title = entities.map((e) => `${e.brand} ${e.name}`).join(' vs ');

  return (
    <ComparisonView
      entities={entities}
      picker={picker}
      ids={ids}
      title={title}
      crumbs={crumbs}
      weights={weights}
    />
  );
}

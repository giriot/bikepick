import Image from 'next/image';
import Link from 'next/link';
import { db } from '@/lib/db';
import { getCompareEntities, listProducts } from '@/lib/queries';
import { buildComparison } from '@/lib/compare';
import { computeScore, DEFAULT_WEIGHTS, explainWin, type ScoreWeights } from '@/lib/score';
import { getJsonSetting } from '@/lib/settings';
import { inr } from '@/lib/format';
import { buildMetadata, breadcrumbJsonLd, JsonLd } from '@/lib/seo';
import { Breadcrumbs, Empty, Notice, ScoreRing, SectionHeader } from '@/components/ui';
import { CompareToggle } from '@/components/CompareToggle';
import { QuickCompare } from '@/components/QuickCompare';
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
              const pids = JSON.parse(c.product_ids) as string[];
              return (
                <Link key={c.id} href={`/compare?ids=${pids.join(',')}`} className="card card-hover p-4">
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

  const { groups, verdict } = buildComparison(entities);
  const scores = entities.map((e) => ({
    entity: e,
    result: computeScore({ price: e.price, fuelType: e.fuelType, bike: e.bike, ev: e.ev, segment: {} }, weights),
  }));
  const winner = [...scores].sort((a, b) => b.result.total - a.result.total)[0];
  const title = entities.map((e) => `${e.brand} ${e.name}`).join(' vs ');

  return (
    <div className="container-xl py-6">
      <JsonLd data={breadcrumbJsonLd([...crumbs, { name: title, url: `/compare?ids=${ids.join(',')}` }])} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em] sm:text-[30px]">{title}</h1>
      <p className="mt-1.5 text-sm text-ink-mute">
        {groups.reduce((a, g) => a + g.rows.length, 0)} attributes compared · best value highlighted in green, weakest in amber.
      </p>

      <div className="mt-5"><QuickCompare products={picker} /></div>

      {/* Header cards */}
      <div className="mt-6 overflow-x-auto">
        <div className="grid min-w-[640px] gap-3" style={{ gridTemplateColumns: `180px repeat(${entities.length}, minmax(180px, 1fr))` }}>
          <div />
          {scores.map(({ entity, result }) => (
            <div key={entity.id} className="card p-3 text-center">
              <div className="product-stage aspect-[8/5]">
                <Image src={entity.image || '/media/commuter.svg'} alt={`${entity.brand} ${entity.name}`} width={280} height={175} className="h-full w-full object-contain" />
              </div>
              <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-mute">{entity.brand}</p>
              <Link href={`/${entity.fuelType === 'electric' ? 'electric' : 'bikes'}/${entity.brandSlug}/${entity.slug}`} className="block text-[14px] font-semibold leading-snug hover:text-brand-600">
                {entity.name}
              </Link>
              <p className="mt-1 text-[15px] font-bold">{inr(entity.price)}</p>
              <div className="mt-2 flex justify-center"><ScoreRing score={result.total} size={62} /></div>
              {winner.entity.id === entity.id && <span className="badge mt-2 bg-accent-soft text-accent-dark">Highest score</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Verdict */}
      <section className="mt-8">
        <SectionHeader title="Verdict" subtitle="Computed from the comparison table — not from advertising." />
        <div className="card p-5">
          <p className="text-[14px] font-semibold">
            {explainWin(`${winner.entity.brand} ${winner.entity.name}`, winner.result, scores.filter((s) => s.entity.id !== winner.entity.id).map((s) => ({ name: `${s.entity.brand} ${s.entity.name}`, result: s.result })))}
          </p>
          <ul className="mt-3 space-y-1.5">
            {verdict.map((v) => (
              <li key={v} className="flex gap-2 text-[13px] leading-6 text-ink-soft">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />{v}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Table */}
      <section className="mt-8 space-y-6">
        {groups.map((g) => (
          <div key={g.group} className="card overflow-hidden">
            <h2 className="border-b border-line bg-surface px-4 py-2.5 text-[13px] font-semibold">{g.group}</h2>
            <div className="overflow-x-auto">
              <table className="table-compare w-full min-w-[640px]">
                <caption className="sr-only">{g.group} comparison</caption>
                <thead>
                  <tr>
                    <th scope="col" className="w-[180px] text-left text-[11px] uppercase tracking-wide text-ink-mute">Attribute</th>
                    {entities.map((e) => (
                      <th key={e.id} scope="col" className="text-left text-[12px] font-semibold">{e.brand} {e.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row" className="text-left text-[13px] font-medium text-ink-mute">
                        {row.label}
                        {row.direction === 'lower' && <span className="ml-1 text-[10px] text-ink-mute" title="Lower is better">↓</span>}
                        {row.direction === 'band' && <span className="ml-1 text-[10px] text-ink-mute" title="A comfortable band wins">≈</span>}
                      </th>
                      {row.cells.map((c) => (
                        <td key={c.entityId} className={c.isBest ? 'bg-accent-soft font-semibold text-accent-dark' : c.isWorst ? 'bg-warn-soft text-[#8A5B00]' : ''}>
                          {c.display}
                          {c.isBest && <span className="sr-only"> (best in this row)</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      <AdSlot slotKey="compare_below_table" className="mt-8" />

      <div className="mt-8 flex flex-wrap gap-2">
        {entities.map((e) => (
          <Link key={e.id} href={`/${e.fuelType === 'electric' ? 'electric' : 'bikes'}/${e.brandSlug}/${e.slug}`} className="btn-outline btn-sm">
            View {e.name} →
          </Link>
        ))}
      </div>
    </div>
  );
}

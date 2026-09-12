import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { getCompareEntities, listProducts } from '@/lib/queries';
import { DEFAULT_WEIGHTS, type ScoreWeights } from '@/lib/score';
import { getJsonSetting } from '@/lib/settings';
import { parseProductIds } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import { ComparisonView } from '@/components/ComparisonView';

export const dynamic = 'force-dynamic';

/** Stored comparison permalinks — /compare/yamaha-mt-15-vs-… — render the real
 *  side-by-side comparison server-side so search engines can index each pair. */
export default async function SavedComparison({ params }: { params: { slug: string } }) {
  const row = await db.get<any>('SELECT * FROM comparisons WHERE slug = ?', [params.slug]);
  if (!row) notFound();
  const ids = parseProductIds(row.product_ids);
  if (ids.length < 2) notFound();

  const [entities, weights] = await Promise.all([
    getCompareEntities(ids),
    getJsonSetting<ScoreWeights>('score_weights', DEFAULT_WEIGHTS),
  ]);
  if (entities.length < 2) notFound();
  await db.run('UPDATE comparisons SET view_count = view_count + 1 WHERE id = ?', [row.id]);

  const picker = (await listProducts({ sort: 'popular', perPage: 40 })).items.map((p) => ({
    id: p.id,
    label: `${p.brand_name} ${p.name}`,
    price: p.price_min,
  }));

  const title = entities.map((e) => `${e.brand} ${e.name}`).join(' vs ');
  const crumbs = [
    { name: 'Home', url: '/' },
    { name: 'Compare', url: '/compare' },
    { name: title, url: `/compare/${row.slug}` },
  ];

  return <ComparisonView entities={entities} picker={picker} ids={ids} title={title} crumbs={crumbs} weights={weights} />;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const row = await db.get<any>('SELECT * FROM comparisons WHERE slug = ?', [params.slug]);
  if (!row) return {};
  const entities = await getCompareEntities(parseProductIds(row.product_ids));
  if (entities.length < 2) return {};
  const names = entities.map((e) => `${e.brand} ${e.name}`);
  return buildMetadata({
    title: `${names.join(' vs ')} — Price, Specs & Mileage Compared`,
    description: `Compare ${names.join(' vs ')} side by side — price, engine, mileage, safety, features and running cost, with the best value in each attribute highlighted.`,
    path: `/compare/${params.slug}`,
    keywords: [names.join(' vs '), `${names.join(' vs ')} comparison`, 'bike compare', 'scooter comparison'],
  });
}

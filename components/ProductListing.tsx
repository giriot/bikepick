import { Suspense } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { listProducts, categoryClause, type ProductFilters } from '@/lib/queries';
import { ProductCard } from '@/components/ProductCard';
import { Filters, SortSelect } from '@/components/Filters';
import { Breadcrumbs, Empty, Pagination } from '@/components/ui';
import { AdSlot } from '@/components/AdSlot';

export interface ListingProps {
  category: 'bikes' | 'electric';
  title: string;
  intro: string;
  searchParams: Record<string, string | string[] | undefined>;
}

const SORTS: [string, string][] = [
  ['popular', 'Most popular'], ['price_low', 'Price: low to high'], ['price_high', 'Price: high to low'],
  ['score', 'Bikepick Score'], ['mileage', 'Mileage / efficiency'], ['newest', 'Newest'],
];

// EVs are sorted by range instead of mileage (kmpl means nothing for electric).
const EV_SORTS: [string, string][] = [
  ['popular', 'Most popular'], ['price_low', 'Price: low to high'], ['price_high', 'Price: high to low'],
  ['score', 'Bikepick Score'], ['range', 'Range (high to low)'], ['newest', 'Newest'],
];

export async function ProductListing({ category, title, intro, searchParams }: ListingProps) {
  const sp = searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined)) || undefined;
  const many = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[]) : sp[k] ? [sp[k] as string] : []);

  const filters: ProductFilters = {
    category,
    brand: many('brand'),
    bodyType: one('bodyType'),
    minPrice: one('minPrice') ? Number(one('minPrice')) : undefined,
    maxPrice: one('maxPrice') ? Number(one('maxPrice')) : undefined,
    minCc: one('minCc') ? Number(one('minCc')) : undefined,
    maxCc: one('maxCc') ? Number(one('maxCc')) : undefined,
    minMileage: one('minMileage') ? Number(one('minMileage')) : undefined,
    abs: one('abs') === '1',
    q: one('q'),
    sort: (one('sort') as ProductFilters['sort']) || 'popular',
    page: one('page') ? Number(one('page')) : 1,
    perPage: 12,
  };

  const cb = categoryClause(category);

  const [result, brands, bodyTypes, priceRow] = await Promise.all([
    listProducts(filters),
    db.all<any>(
      `SELECT b.slug, b.name, MAX(b.logo_url) AS logo_url, COUNT(p.id) AS count FROM brands b
         JOIN products p ON p.brand_id = b.id
         JOIN categories c ON c.id = p.category_id
        WHERE ${cb.sql} AND p.status = 'published' AND p.deleted_at IS NULL
        GROUP BY b.slug, b.name ORDER BY b.name`,
      cb.params,
    ),
    db.all<any>(
      `SELECT DISTINCT p.body_type FROM products p JOIN categories c ON c.id = p.category_id
        WHERE ${cb.sql} AND p.body_type IS NOT NULL AND p.status = 'published'`,
      cb.params,
    ),
    db.get<any>(`SELECT MAX(price_min) AS m FROM products WHERE status='published'`),
  ]);

  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'page') continue;
    (Array.isArray(v) ? v : v ? [v] : []).forEach((val) => query.append(k, val as string));
  }
  const base = `/${category}${query.toString() ? `?${query}` : ''}`;

  return (
    <div className="container-xl py-6">
      <Breadcrumbs items={[{ name: 'Home', url: '/' }, { name: title, url: `/${category}` }]} />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] sm:text-[32px]">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-mute">{intro}</p>
        </div>
        <Suspense fallback={null}><SortSelect options={category === 'electric' ? EV_SORTS : SORTS} /></Suspense>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[268px_1fr]">
        <Suspense fallback={<div className="skeleton h-96" />}>
          <Filters
            config={{
              brands: brands.map((b) => ({ slug: b.slug, name: b.name, count: Number(b.count), logo: b.logo_url || null })),
              bodyTypes: bodyTypes.map((b) => b.body_type),
              isEv: category === 'electric',
              priceMax: Math.ceil(Number(priceRow?.m || 300000)),
            }}
          />
        </Suspense>

        <div>
          <p className="mb-4 text-[13px] text-ink-mute" aria-live="polite">
            <strong className="font-semibold text-ink">{result.total}</strong> model{result.total === 1 ? '' : 's'} found
            {result.pages > 1 && ` · page ${result.page} of ${result.pages}`}
          </p>

          {result.items.length === 0 ? (
            <Empty
              title="No models match these filters"
              body="Try widening your budget or clearing a filter. If a model is missing entirely, an administrator can add it from the admin panel. If the list looks empty but you know models exist, press Reload — a momentary server hiccup is retried automatically."
              action={
                <>
                  <Link href={`/${category}`} className="btn-primary btn-sm mt-2">Clear filters</Link>
                  <a href={base} className="btn-outline btn-sm mt-2 ml-2">Reload</a>
                </>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.items.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
              <Pagination page={result.page} pages={result.pages} base={base} />
            </>
          )}

          <AdSlot slotKey="home_mid" className="mt-8" />
        </div>
      </div>
    </div>
  );
}

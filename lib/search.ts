import 'server-only';
import { db } from './db';
import { normalizeKey, searchTokens } from './slug';

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
  image: string | null;
  meta: string | null;
  rank: number;
}
export interface SearchGroup { key: string; label: string; hits: SearchHit[] }

/**
 * Database-backed global search.
 *
 * Handles Indian model-name spelling variance ("MT15" / "MT 15" / "MT-15" /
 * "Yamaha MT") by matching on three surfaces:
 *   1. normalized_key  — punctuation/space-insensitive contains
 *   2. per-token LIKE  — every token must appear somewhere in brand+name
 *   3. prefix boost    — exact prefix ranks above mid-string matches
 */
export async function globalSearch(query: string, limitPerGroup = 6): Promise<SearchGroup[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const nk = normalizeKey(q);
  const tokens = searchTokens(q).slice(0, 5);
  const like = `%${q.toLowerCase()}%`;

  const tokenClause = tokens.length
    ? tokens.map(() => `(LOWER(b.name || ' ' || p.name) LIKE ? OR p.normalized_key LIKE ?)`).join(' AND ')
    : '1=1';
  const tokenParams = tokens.flatMap((t) => [`%${t}%`, `%${normalizeKey(t)}%`]);

  const products = await db.all<any>(
    `SELECT p.id, p.name, p.slug, p.fuel_type, p.price_min, p.score, p.normalized_key,
            b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug,
            (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1
              ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image_url
       FROM products p
       JOIN brands b ON b.id = p.brand_id
       JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.deleted_at IS NULL
        AND (p.normalized_key LIKE ? OR LOWER(b.name || ' ' || p.name) LIKE ? OR (${tokenClause}))
      LIMIT 40`,
    [`%${nk}%`, like, ...tokenParams],
  );

  const rankProduct = (r: any) => {
    const key = r.normalized_key as string;
    let rank = 0;
    if (key === nk) rank += 100;
    else if (key.startsWith(nk)) rank += 60;
    else if (key.includes(nk)) rank += 35;
    if (String(r.name).toLowerCase().startsWith(q.toLowerCase())) rank += 20;
    rank += Math.min(10, (r.score || 0) / 10);
    return rank;
  };

  const productHits: SearchHit[] = products
    .map((r) => ({
      id: r.id,
      title: `${r.brand_name} ${r.name}`,
      subtitle: r.fuel_type === 'electric' ? 'Electric' : 'Petrol',
      url: `/${r.category_slug === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`,
      image: r.image_url,
      meta: r.price_min ? `₹${Math.round(r.price_min).toLocaleString('en-IN')} onwards` : null,
      rank: rankProduct(r),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limitPerGroup);

  const used = await db.all<any>(
    `SELECT u.id, u.slug, u.brand_name, u.model_name, u.manufacture_year, u.km_driven, u.city,
            u.asking_price, u.trust_band,
            (SELECT image_url FROM used_bike_images i WHERE i.used_bike_id = u.id AND i.approved = 1 ORDER BY i.sort_order LIMIT 1) AS image_url
       FROM used_bikes u
      WHERE u.status = 'approved' AND u.deleted_at IS NULL
        AND LOWER(u.brand_name || ' ' || u.model_name) LIKE ?
      ORDER BY u.trust_score DESC LIMIT ?`,
    [like, limitPerGroup],
  );

  const dealers = await db.all<any>(
    `SELECT id, business_name, city, state FROM dealer_profiles
      WHERE status = 'verified' AND deleted_at IS NULL
        AND (LOWER(business_name) LIKE ? OR LOWER(city) LIKE ?) LIMIT ?`,
    [like, like, limitPerGroup],
  );

  const articles = await db.all<any>(
    `SELECT id, title, slug, excerpt FROM articles
      WHERE published = 1 AND deleted_at IS NULL
        AND (LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ?) LIMIT ?`,
    [like, like, limitPerGroup],
  );

  const comparisons = await db.all<any>(
    `SELECT id, slug, title FROM comparisons WHERE LOWER(title) LIKE ? ORDER BY view_count DESC LIMIT ?`,
    [like, limitPerGroup],
  );

  const groups: SearchGroup[] = [
    { key: 'products', label: 'Bikes & scooters', hits: productHits },
    {
      key: 'comparisons', label: 'Comparisons',
      hits: comparisons.map((c) => ({
        id: c.id, title: c.title, subtitle: 'Comparison', url: `/compare/${c.slug}`, image: null, meta: null, rank: 0,
      })),
    },
    {
      key: 'used', label: 'Used bikes',
      hits: used.map((u) => ({
        id: u.id,
        title: `${u.brand_name} ${u.model_name} (${u.manufacture_year})`,
        subtitle: `${u.city} · ${Number(u.km_driven).toLocaleString('en-IN')} km`,
        url: `/used-bikes/${u.slug}`,
        image: u.image_url,
        meta: `₹${Math.round(u.asking_price).toLocaleString('en-IN')}`,
        rank: 0,
      })),
    },
    {
      key: 'dealers', label: 'Dealers',
      hits: dealers.map((d) => ({
        id: d.id, title: d.business_name, subtitle: `${d.city}, ${d.state}`, url: `/dealers/${d.id}`, image: null, meta: null, rank: 0,
      })),
    },
    {
      key: 'articles', label: 'Guides & articles',
      hits: articles.map((a) => ({
        id: a.id, title: a.title, subtitle: a.excerpt?.slice(0, 90) || null, url: `/guides/${a.slug}`, image: null, meta: null, rank: 0,
      })),
    },
  ];

  return groups.filter((g) => g.hits.length > 0);
}

/** Lightweight autocomplete used by the header search box. */
export async function suggest(query: string, limit = 8): Promise<{ label: string; url: string; kind: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const nk = normalizeKey(q);
  const rows = await db.all<any>(
    `SELECT p.name, p.slug, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug, p.normalized_key
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.deleted_at IS NULL
        AND (p.normalized_key LIKE ? OR LOWER(b.name || ' ' || p.name) LIKE ?)
      LIMIT ?`,
    [`%${nk}%`, `%${q.toLowerCase()}%`, limit * 2],
  );
  return rows
    .sort((a, b) => Number(b.normalized_key.startsWith(nk)) - Number(a.normalized_key.startsWith(nk)))
    .slice(0, limit)
    .map((r) => ({
      label: `${r.brand_name} ${r.name}`,
      url: `/${r.category_slug === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`,
      kind: 'product',
    }));
}

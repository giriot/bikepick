import 'server-only';
import { db } from './db';
import { normalizeKey, searchTokens, fuzzyMatches } from './slug';

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
 * Some records store the brand inside the model name (\"Honda Activa E\"),
 * so a naive `${brand} ${name}` renders as \"Honda Honda Activa E\". Join
 * the two without repeating the brand.
 */
export function displayName(brand: string, name: string): string {
  const b = (brand || '').trim();
  const n = (name || '').trim();
  if (b && n.toLowerCase().startsWith(b.toLowerCase())) {
    const rest = n.slice(b.length).replace(/^[\s-]+/, '');
    return rest ? `${b} ${rest}` : n;
  }
  return b && n ? `${b} ${n}` : n || b;
}
export interface SearchResult {
  groups: SearchGroup[];
  /** Best typo-corrected product name when the literal query matched nothing, else null. */
  didYouMean: string | null;
}

/**
 * Database-backed global search.
 *
 * Handles Indian model-name spelling variance ("MT15" / "MT 15" / "MT-15" /
 * "Yamaha MT") by matching on three surfaces:
 *   1. normalized_key  — punctuation/space-insensitive contains
 *   2. per-token LIKE  — every token must appear somewhere in brand+name
 *   3. prefix boost    — exact prefix ranks above mid-string matches
 * and adds a typo-tolerant fuzzy pass (edit-distance on the whole name and
 * on each token) so "aktiva" still finds "Activa 6G" and "raiderr" finds
 * "Raider 125".
 */
export async function globalSearch(query: string, limitPerGroup = 6): Promise<SearchResult> {
  const q = query.trim();
  if (q.length < 2) return { groups: [], didYouMean: null };
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

  const literalProductHits: SearchHit[] = products
    .map((r) => ({
      id: r.id,
      title: displayName(r.brand_name, r.name),
      subtitle: r.fuel_type === 'electric' ? 'Electric' : 'Petrol',
      url: `/${r.fuel_type === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`,
      image: r.image_url,
      meta: r.price_min ? `₹${Math.round(r.price_min).toLocaleString('en-IN')} onwards` : null,
      rank: rankProduct(r),
    }))
    .sort((a, b) => b.rank - a.rank);

  // Typo-tolerant pass over the whole catalogue (it is small — tens of rows).
  // Only matches the literal pass missed, ranked below any literal hit.
  const literalIds = new Set(literalProductHits.map((h) => h.id));
  let fuzzyProductHits: SearchHit[] = [];
  if (literalProductHits.length < limitPerGroup) {
    const all = await db.all<any>(
      `SELECT p.id, p.name, p.slug, p.fuel_type, p.price_min, p.score, p.normalized_key,
              b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug,
              (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1
                ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image_url
         FROM products p
         JOIN brands b ON b.id = p.brand_id
         JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL`,
    );
    fuzzyProductHits = all
      .filter((r) => !literalIds.has(r.id) && fuzzyMatches(q, `${r.brand_name} ${r.name}`))
      .map((r) => ({
        id: r.id,
        title: displayName(r.brand_name, r.name),
        subtitle: r.fuel_type === 'electric' ? 'Electric' : 'Petrol',
        url: `/${r.fuel_type === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`,
        image: r.image_url,
        meta: r.price_min ? `₹${Math.round(r.price_min).toLocaleString('en-IN')} onwards` : null,
        rank: 10 + Math.min(10, (r.score || 0) / 10), // below any literal match
      }))
      .sort((a, b) => b.rank - a.rank);
  }

  const productHits = [...literalProductHits, ...fuzzyProductHits].slice(0, limitPerGroup);
  const didYouMean =
    literalProductHits.length === 0 && fuzzyProductHits.length > 0 ? fuzzyProductHits[0].title : null;

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
      key: 'articles', label: 'Guides & articles',
      hits: articles.map((a) => ({
        id: a.id, title: a.title, subtitle: a.excerpt?.slice(0, 90) || null, url: `/guides/${a.slug}`, image: null, meta: null, rank: 0,
      })),
    },
  ];

  return { groups: groups.filter((g) => g.hits.length > 0), didYouMean };
}

/**
 * Lightweight autocomplete used by the header search box. Products first
 * (prefix-boosted), then used bikes, guides and brands, so the dropdown is
 * useful beyond the catalogue.
 */
export async function suggest(query: string, limit = 8): Promise<{ label: string; url: string; kind: string }[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const nk = normalizeKey(q);
  const like = `%${q.toLowerCase()}%`;

  const rows = await db.all<any>(
    `SELECT p.name, p.slug, p.fuel_type, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug, p.normalized_key
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'published' AND p.deleted_at IS NULL
        AND (p.normalized_key LIKE ? OR LOWER(b.name || ' ' || p.name) LIKE ?)
      LIMIT ?`,
    [`%${nk}%`, like, limit * 2],
  );
  // Typo-tolerant fallback so the dropdown also catches "aktiva" → Activa 6G.
  if (rows.length < limit) {
    const all = await db.all<any>(
      `SELECT p.name, p.slug, p.fuel_type, b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug, p.normalized_key
         FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'published' AND p.deleted_at IS NULL`,
    );
    const seen = new Set(rows.map((r) => r.normalized_key));
    for (const r of all) {
      if (rows.length >= limit) break;
      if (seen.has(r.normalized_key)) continue;
      if (fuzzyMatches(q, `${r.brand_name} ${r.name}`)) rows.push(r);
    }
  }

  const out: { label: string; url: string; kind: string }[] = rows
    .sort((a, b) => Number(b.normalized_key.startsWith(nk)) - Number(a.normalized_key.startsWith(nk)))
    .slice(0, limit)
    .map((r) => ({
      label: displayName(r.brand_name, r.name),
      url: `/${r.fuel_type === 'electric' ? 'electric' : 'bikes'}/${r.brand_slug}/${r.slug}`,
      kind: 'product',
    }));

  if (out.length < limit) {
    const used = await db.all<any>(
      `SELECT slug, brand_name, model_name, manufacture_year FROM used_bikes
        WHERE status = 'approved' AND deleted_at IS NULL AND LOWER(brand_name || ' ' || model_name) LIKE ?
        ORDER BY approved_at DESC LIMIT ?`,
      [like, limit - out.length],
    );
    for (const u of used) {
      out.push({ label: `${u.brand_name} ${u.model_name} · used`, url: `/used-bikes/${u.slug}`, kind: 'used' });
    }
  }

  if (out.length < limit) {
    const guides = await db.all<any>(
      `SELECT slug, title FROM articles WHERE published = 1 AND deleted_at IS NULL AND LOWER(title) LIKE ? LIMIT ?`,
      [like, limit - out.length],
    );
    for (const g of guides) out.push({ label: g.title, url: `/guides/${g.slug}`, kind: 'guide' });
  }

  if (out.length < limit) {
    const brands = await db.all<any>(
      `SELECT b.name FROM brands b WHERE LOWER(b.name) LIKE ? ORDER BY b.name LIMIT ?`,
      [`%${q.toLowerCase()}%`, limit - out.length],
    );
    for (const b of brands) {
      out.push({ label: `${b.name} — all models`, url: `/search?q=${encodeURIComponent(b.name)}`, kind: 'brand' });
    }
  }

  return out;
}

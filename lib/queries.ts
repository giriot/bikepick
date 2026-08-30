import 'server-only';
import { db } from './db';
import type { CompareEntity } from './compare';

export interface ProductFilters {
  category?: string;
  brand?: string | string[];
  fuel?: string;
  minPrice?: number;
  maxPrice?: number;
  minCc?: number;
  maxCc?: number;
  minMileage?: number;
  abs?: boolean;
  bodyType?: string;
  q?: string;
  sort?: 'popular' | 'price_low' | 'price_high' | 'score' | 'newest' | 'mileage';
  page?: number;
  perPage?: number;
}

export interface ProductCard {
  id: string; name: string; slug: string; brand_name: string; brand_slug: string;
  category_slug: string; fuel_type: string | null; body_type: string | null;
  price_min: number | null; price_max: number | null; score: number | null;
  image_url: string | null; alt_text: string | null; is_demo: number; featured: number;
  engine_capacity_cc: number | null; mileage_kmpl: number | null; max_power_bhp: number | null;
  abs_type: string | null; claimed_range_km: number | null; real_world_range_km: number | null;
  battery_capacity_kwh: number | null;
}

const CARD_SELECT = `
  SELECT p.id, p.name, p.slug, p.fuel_type, p.body_type, p.price_min, p.price_max, p.score,
         p.is_demo, p.featured, p.popularity,
         b.name AS brand_name, b.slug AS brand_slug, c.slug AS category_slug,
         bs.engine_capacity_cc, bs.mileage_kmpl, bs.max_power_bhp, bs.abs_type,
         es.claimed_range_km, es.real_world_range_km, es.battery_capacity_kwh,
         (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1
           ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image_url,
         (SELECT alt_text FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1
           ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS alt_text
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
    LEFT JOIN ev_specs es ON es.product_id = p.id AND es.variant_id IS NULL`;

export async function listProducts(f: ProductFilters = {}): Promise<{ items: ProductCard[]; total: number; page: number; pages: number }> {
  const where: string[] = ["p.status = 'published'", 'p.deleted_at IS NULL'];
  const params: any[] = [];

  if (f.category) { where.push('c.slug = ?'); params.push(f.category); }
  if (f.fuel) { where.push('p.fuel_type = ?'); params.push(f.fuel); }
  if (f.bodyType) { where.push('p.body_type = ?'); params.push(f.bodyType); }
  if (f.brand) {
    const brands = Array.isArray(f.brand) ? f.brand : [f.brand];
    if (brands.length) {
      where.push(`b.slug IN (${brands.map(() => '?').join(',')})`);
      params.push(...brands);
    }
  }
  if (f.minPrice) { where.push('p.price_min >= ?'); params.push(f.minPrice); }
  if (f.maxPrice) { where.push('p.price_min <= ?'); params.push(f.maxPrice); }
  if (f.minCc) { where.push('bs.engine_capacity_cc >= ?'); params.push(f.minCc); }
  if (f.maxCc) { where.push('bs.engine_capacity_cc <= ?'); params.push(f.maxCc); }
  if (f.minMileage) { where.push('bs.mileage_kmpl >= ?'); params.push(f.minMileage); }
  if (f.abs) { where.push("bs.abs_type IS NOT NULL AND bs.abs_type <> ''"); }
  if (f.q) {
    where.push("(LOWER(b.name || ' ' || p.name) LIKE ? OR p.normalized_key LIKE ?)");
    params.push(`%${f.q.toLowerCase()}%`, `%${f.q.toLowerCase().replace(/[^a-z0-9]/g, '')}%`);
  }

  const sortMap: Record<string, string> = {
    popular: 'p.featured DESC, p.popularity DESC, p.score DESC',
    price_low: 'p.price_min ASC',
    price_high: 'p.price_min DESC',
    score: 'p.score DESC',
    newest: 'p.model_year DESC, p.created_at DESC',
    mileage: 'bs.mileage_kmpl DESC',
  };
  const orderBy = sortMap[f.sort || 'popular'] || sortMap.popular;

  const page = Math.max(1, f.page || 1);
  const perPage = Math.min(48, f.perPage || 12);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRow = await db.get<any>(
    `SELECT COUNT(*) AS n FROM products p
      JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
      LEFT JOIN bike_specs bs ON bs.product_id = p.id AND bs.variant_id IS NULL
      ${whereSql}`,
    params,
  );
  const total = Number(countRow?.n || 0);

  const items = await db.all<ProductCard>(
    `${CARD_SELECT} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );

  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getProductBySlug(brandSlug: string, slug: string) {
  const product = await db.get<any>(
    `SELECT p.*, b.name AS brand_name, b.slug AS brand_slug, b.logo_url AS brand_logo,
            b.official_website, c.slug AS category_slug, c.name AS category_name
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
      WHERE b.slug = ? AND p.slug = ? AND p.deleted_at IS NULL`,
    [brandSlug, slug],
  );
  if (!product) return null;

  const [variants, images, bike, ev, sources, prices, offers, reviews, priceHistory] = await Promise.all([
    db.all<any>('SELECT * FROM product_variants WHERE product_id = ? AND deleted_at IS NULL ORDER BY sort_order, price', [product.id]),
    db.all<any>('SELECT * FROM product_images WHERE product_id = ? AND approved = 1 AND deleted_at IS NULL ORDER BY is_primary DESC, sort_order', [product.id]),
    db.get<any>('SELECT * FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [product.id]),
    db.get<any>('SELECT * FROM ev_specs WHERE product_id = ? AND variant_id IS NULL', [product.id]),
    db.all<any>('SELECT * FROM product_sources WHERE product_id = ? ORDER BY created_at DESC', [product.id]),
    db.all<any>('SELECT * FROM product_prices WHERE product_id = ? ORDER BY city', [product.id]),
    db.all<any>(
      `SELECT o.*, d.business_name, d.city AS dealer_city, d.phone, d.whatsapp, d.rating
         FROM dealer_offers o JOIN dealer_profiles d ON d.id = o.dealer_id
        WHERE o.product_id = ? AND o.status = 'approved' AND o.deleted_at IS NULL
          AND (o.end_date IS NULL OR o.end_date >= ?)
        ORDER BY o.featured DESC, o.discount DESC`,
      [product.id, new Date().toISOString().slice(0, 10)],
    ),
    db.all<any>(
      `SELECT r.*, u.full_name FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.product_id = ? AND r.status = 'approved' AND r.deleted_at IS NULL
        ORDER BY r.created_at DESC LIMIT 20`,
      [product.id],
    ),
    db.all<any>('SELECT recorded_at, price, source_name, retailer, verified FROM price_history WHERE product_id = ? ORDER BY recorded_at', [product.id]),
  ]);

  return { product, variants, images, bike, ev, sources, prices, offers, reviews, priceHistory };
}

export async function getCompareEntities(ids: string[]): Promise<CompareEntity[]> {
  if (!ids.length) return [];
  const rows = await db.all<any>(
    `SELECT p.id, p.name, p.slug, p.fuel_type, p.price_min, p.score,
            b.name AS brand_name, b.slug AS brand_slug,
            (SELECT image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.approved = 1
              ORDER BY pi.is_primary DESC, pi.sort_order LIMIT 1) AS image_url
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.id IN (${ids.map(() => '?').join(',')}) AND p.status = 'published' AND p.deleted_at IS NULL`,
    ids,
  );
  const out: CompareEntity[] = [];
  for (const id of ids) {
    const r = rows.find((x) => x.id === id);
    if (!r) continue;
    const [bike, ev] = await Promise.all([
      db.get<any>('SELECT * FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [id]),
      db.get<any>('SELECT * FROM ev_specs WHERE product_id = ? AND variant_id IS NULL', [id]),
    ]);
    out.push({
      id: r.id, name: r.name, brand: r.brand_name, slug: r.slug, brandSlug: r.brand_slug,
      image: r.image_url, price: r.price_min, fuelType: r.fuel_type, score: r.score,
      bike: bike || null, ev: ev || null,
    });
  }
  return out;
}

export interface UsedBikeFilters {
  q?: string; brand?: string; city?: string; minPrice?: number; maxPrice?: number;
  minYear?: number; maxKm?: number; owners?: number; fuel?: string; abs?: boolean;
  condition?: string; sellerType?: string; verifiedOnly?: boolean; minTrust?: number;
  sort?: 'newest' | 'price_low' | 'price_high' | 'km_low' | 'trust' | 'best_value';
  page?: number; perPage?: number;
}

export async function listUsedBikes(f: UsedBikeFilters = {}) {
  const where: string[] = ["u.status = 'approved'", 'u.deleted_at IS NULL'];
  const params: any[] = [];
  if (f.q) { where.push("LOWER(u.brand_name || ' ' || u.model_name) LIKE ?"); params.push(`%${f.q.toLowerCase()}%`); }
  if (f.brand) { where.push('LOWER(u.brand_name) = ?'); params.push(f.brand.toLowerCase()); }
  if (f.city) { where.push('LOWER(u.city) = ?'); params.push(f.city.toLowerCase()); }
  if (f.minPrice) { where.push('u.asking_price >= ?'); params.push(f.minPrice); }
  if (f.maxPrice) { where.push('u.asking_price <= ?'); params.push(f.maxPrice); }
  if (f.minYear) { where.push('u.manufacture_year >= ?'); params.push(f.minYear); }
  if (f.maxKm) { where.push('u.km_driven <= ?'); params.push(f.maxKm); }
  if (f.owners) { where.push('u.owners <= ?'); params.push(f.owners); }
  if (f.fuel) { where.push('u.fuel_type = ?'); params.push(f.fuel); }
  if (f.abs) { where.push('u.abs_equipped = 1'); }
  if (f.condition) { where.push('u.condition_grade = ?'); params.push(f.condition); }
  if (f.sellerType) { where.push('u.seller_type = ?'); params.push(f.sellerType); }
  if (f.verifiedOnly) { where.push("u.trust_band IN ('excellent','good')"); }
  if (f.minTrust) { where.push('u.trust_score >= ?'); params.push(f.minTrust); }

  const sortMap: Record<string, string> = {
    newest: 'u.approved_at DESC',
    price_low: 'u.asking_price ASC',
    price_high: 'u.asking_price DESC',
    km_low: 'u.km_driven ASC',
    trust: 'u.trust_score DESC',
    best_value: "CASE u.price_verdict WHEN 'good_deal' THEN 0 WHEN 'fair_price' THEN 1 ELSE 2 END, u.trust_score DESC",
  };
  const page = Math.max(1, f.page || 1);
  const perPage = Math.min(36, f.perPage || 12);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const countRow = await db.get<any>(`SELECT COUNT(*) AS n FROM used_bikes u ${whereSql}`, params);
  const items = await db.all<any>(
    `SELECT u.*, (SELECT image_url FROM used_bike_images i WHERE i.used_bike_id = u.id AND i.approved = 1 ORDER BY i.sort_order LIMIT 1) AS image_url
       FROM used_bikes u ${whereSql}
      ORDER BY u.featured DESC, ${sortMap[f.sort || 'newest'] || sortMap.newest}
      LIMIT ? OFFSET ?`,
    [...params, perPage, (page - 1) * perPage],
  );
  const total = Number(countRow?.n || 0);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getStats() {
  const q = async (sql: string, p: any[] = []) => Number((await db.get<any>(sql, p))?.n || 0);
  const [bikes, evs, used, dealers, offers] = await Promise.all([
    q("SELECT COUNT(*) AS n FROM products WHERE status='published' AND deleted_at IS NULL"),
    q("SELECT COUNT(*) AS n FROM products WHERE status='published' AND fuel_type='electric' AND deleted_at IS NULL"),
    q("SELECT COUNT(*) AS n FROM used_bikes WHERE status='approved' AND deleted_at IS NULL"),
    q("SELECT COUNT(*) AS n FROM dealer_profiles WHERE status='verified' AND deleted_at IS NULL"),
    q("SELECT COUNT(*) AS n FROM dealer_offers WHERE status='approved' AND deleted_at IS NULL"),
  ]);
  return { bikes, evs, used, dealers, offers };
}

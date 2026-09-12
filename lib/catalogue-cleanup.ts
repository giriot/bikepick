/**
 * One-shot catalogue cleanup — merge true duplicate products and strip
 * brand-prefixed model names.
 *
 * Idempotent: every step is guarded so a second run is a no-op.
 * Safe on empty / SQLite local DBs (no matching rows → nothing happens).
 *
 * Triggered once per cold Postgres instance via PG_RUNTIME_MIGRATIONS
 * (see lib/db.ts) under the name `rt_catalogue_dedupe_2026_09`.
 */
import { db, nowIso, uid } from './db';
import { cleanModelName } from './format';
import { normalizeKey, slugify } from './slug';
import { syncProductIdPrices } from './pricing-sync';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  brand_id: string;
  brand_slug: string;
  brand_name: string;
  status: string;
  price_min: number | null;
  price_max: number | null;
  deleted_at: string | null;
};

/** Pairs of (brand_slug, keep_slug, drop_slug) — the thinner twin is unpublished. */
const DUPLICATE_PAIRS: { brand: string; keep: string; drop: string; keepName: string }[] = [
  // TVS Raider 125 — keep the page with 7 variants + gallery
  { brand: 'tvs', keep: 'raider-125', drop: 'tvs-raider-125', keepName: 'Raider 125' },
  // Royal Enfield Hunter 350 — keep the page with Retro/Metro variants
  { brand: 'royal-enfield', keep: 'hunter-350', drop: 'royal-enfield-hunter-350', keepName: 'Hunter 350' },
  // TVS Sport — keep the page with Kick/Self variants
  { brand: 'tvs', keep: 'sport', drop: 'tvs-sport', keepName: 'Sport' },
];

/** Shine 100 twins: keep the better-scored / more complete row, drop the other. */
const SHINE_100_SLUGS = ['Shine100', 'shine100', 'honda-shine-100', 'shine-100'];

/** Shine 100 DX was published as its own product — fold into Shine 100 as a variant. */
const SHINE_100_DX_SLUGS = ['honda-shine-100-dx', 'shine-100-dx'];

async function findByBrandSlug(brandSlug: string, productSlug: string): Promise<ProductRow | undefined> {
  return db.get<ProductRow>(
    `SELECT p.id, p.name, p.slug, p.brand_id, p.status, p.price_min, p.price_max, p.deleted_at,
            b.slug AS brand_slug, b.name AS brand_name
       FROM products p
       JOIN brands b ON b.id = p.brand_id
      WHERE b.slug = ? AND LOWER(p.slug) = LOWER(?) AND p.deleted_at IS NULL
      LIMIT 1`,
    [brandSlug, productSlug],
  );
}

async function unpublish(productId: string, reason: string) {
  // Free unique indexes (brand_id,slug) and normalized_key — they are NOT
  // partial on deleted_at, so a soft-delete alone would still block the keep
  // row from claiming the canonical slug/key.
  const row = await db.get<{ slug: string; normalized_key: string }>(
    `SELECT slug, normalized_key FROM products WHERE id = ?`,
    [productId],
  );
  const suffix = `-deduped-${productId.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`;
  const freeSlug = row ? `${row.slug}${suffix}`.slice(0, 180) : `deduped${suffix}`;
  const freeKey = row ? `${row.normalized_key}${suffix}`.slice(0, 180) : `deduped${suffix}`;

  await db.run(
    `UPDATE products
        SET status = 'unpublished',
            slug = ?,
            normalized_key = ?,
            deleted_at = COALESCE(deleted_at, ?),
            updated_at = ?
      WHERE id = ?`,
    [freeSlug, freeKey, nowIso(), nowIso(), productId],
  );
  await db.run(
    `INSERT INTO audit_logs (id, actor_email, actor_role, action, entity_type, entity_id, detail, created_at, updated_at)
     VALUES (?, 'system', 'admin', 'products.dedupe', 'products', ?, ?, ?, ?)`,
    [uid('aud'), productId, reason, nowIso(), nowIso()],
  ).catch(() => undefined);
}

async function renameKeep(p: ProductRow, cleanName: string) {
  const newSlug = slugify(cleanName);
  const newKey = normalizeKey(p.brand_name, cleanName);
  // Only rewrite name/slug when they still carry the brand or a messy slug.
  const needsName = p.name !== cleanName;
  const needsSlug = p.slug.toLowerCase() !== newSlug;
  if (!needsName && !needsSlug) return;

  // Avoid unique-index collisions: if another live product already owns the
  // target slug under this brand, only rewrite the name.
  if (needsSlug) {
    const clash = await db.get<any>(
      `SELECT id FROM products WHERE brand_id = ? AND LOWER(slug) = ? AND id <> ? AND deleted_at IS NULL`,
      [p.brand_id, newSlug, p.id],
    );
    if (clash) {
      await db.run(`UPDATE products SET name = ?, updated_at = ? WHERE id = ?`, [cleanName, nowIso(), p.id]);
      return;
    }
  }
  // normalized_key may also collide with the drop twin before it is soft-deleted.
  const keyClash = await db.get<any>(
    `SELECT id FROM products WHERE normalized_key = ? AND id <> ? AND deleted_at IS NULL`,
    [newKey, p.id],
  );
  if (keyClash) {
    await db.run(
      `UPDATE products SET name = ?${needsSlug ? ', slug = ?' : ''}, updated_at = ? WHERE id = ?`,
      needsSlug ? [cleanName, newSlug, nowIso(), p.id] : [cleanName, nowIso(), p.id],
    );
    return;
  }
  await db.run(
    `UPDATE products SET name = ?, slug = ?, normalized_key = ?, updated_at = ? WHERE id = ?`,
    [cleanName, needsSlug ? newSlug : p.slug, newKey, nowIso(), p.id],
  );
}

/** Move any variants / images from drop → keep that keep does not already have. */
async function rehomeChildren(keepId: string, dropId: string) {
  // Variants: re-point only when keep has no variant with the same name.
  const dropVariants = await db.all<any>(
    `SELECT * FROM product_variants WHERE product_id = ? AND deleted_at IS NULL`,
    [dropId],
  );
  for (const v of dropVariants) {
    const exists = await db.get<any>(
      `SELECT id FROM product_variants WHERE product_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL`,
      [keepId, v.name],
    );
    if (exists) {
      // Soft-delete the drop twin's variant so it doesn't linger.
      await db.run(
        `UPDATE product_variants SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        [nowIso(), nowIso(), v.id],
      );
      continue;
    }
    await db.run(
      `UPDATE product_variants SET product_id = ?, updated_at = ? WHERE id = ?`,
      [keepId, nowIso(), v.id],
    );
    // Move any per-variant bike_specs with it.
    await db.run(
      `UPDATE bike_specs SET product_id = ? WHERE variant_id = ?`,
      [keepId, v.id],
    ).catch(() => undefined);
    await db.run(
      `UPDATE ev_specs SET product_id = ? WHERE variant_id = ?`,
      [keepId, v.id],
    ).catch(() => undefined);
  }

  // Images: re-point all approved images from drop → keep.
  await db.run(
    `UPDATE product_images SET product_id = ?, updated_at = ? WHERE product_id = ? AND deleted_at IS NULL`,
    [keepId, nowIso(), dropId],
  ).catch(() => undefined);

  await syncProductIdPrices(keepId).catch(() => undefined);
}

async function mergeDuplicatePair(pair: typeof DUPLICATE_PAIRS[number]) {
  const keep = await findByBrandSlug(pair.brand, pair.keep);
  const drop = await findByBrandSlug(pair.brand, pair.drop);
  if (!keep && !drop) return; // neither present (local empty DB)
  if (keep && drop && keep.id === drop.id) return;

  if (keep && drop) {
    await rehomeChildren(keep.id, drop.id);
    await renameKeep(keep, pair.keepName);
    await unpublish(drop.id, `dedupe: duplicate of ${pair.brand}/${pair.keep} (${pair.keepName})`);
    return;
  }
  // Only one side present — still clean its name/slug.
  const only = keep || drop!;
  await renameKeep(only, pair.keepName);
}

async function consolidateShine100() {
  // Collect every live Shine 100-ish product under Honda.
  const candidates: ProductRow[] = [];
  for (const slug of SHINE_100_SLUGS) {
    const p = await findByBrandSlug('honda', slug);
    if (p && !candidates.find((c) => c.id === p.id)) candidates.push(p);
  }
  // Also catch by normalized name in case slug differs.
  const byName = await db.all<ProductRow>(
    `SELECT p.id, p.name, p.slug, p.brand_id, p.status, p.price_min, p.price_max, p.deleted_at,
            b.slug AS brand_slug, b.name AS brand_name
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE b.slug = 'honda' AND p.deleted_at IS NULL
        AND (
          LOWER(REPLACE(p.name, ' ', '')) IN ('shine100', 'shine100standard')
          OR LOWER(p.slug) IN ('shine100','honda-shine-100','shine-100')
        )`,
  );
  for (const p of byName) {
    if (!candidates.find((c) => c.id === p.id)) candidates.push(p);
  }

  if (candidates.length === 0) return;

  // Prefer the one that already has variants, else the lowest price_min, else first.
  const scored = await Promise.all(candidates.map(async (c) => {
    const vc = await db.get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM product_variants WHERE product_id = ? AND deleted_at IS NULL`,
      [c.id],
    );
    return { p: c, variants: Number(vc?.c || 0) };
  }));
  scored.sort((a, b) => b.variants - a.variants || (a.p.price_min ?? 9e9) - (b.p.price_min ?? 9e9));
  const keep = scored[0].p;
  await renameKeep(keep, 'Shine 100');

  for (const extra of scored.slice(1)) {
    await rehomeChildren(keep.id, extra.p.id);
    await unpublish(extra.p.id, `dedupe: Shine 100 twin of ${keep.slug}`);
  }

  // Fold Shine 100 DX into keep as a variant (if it exists as its own product).
  for (const dxSlug of SHINE_100_DX_SLUGS) {
    const dx = await findByBrandSlug('honda', dxSlug);
    if (!dx) continue;
    // Ensure a "DX" variant exists on keep.
    const existingDx = await db.get<any>(
      `SELECT id FROM product_variants WHERE product_id = ? AND LOWER(name) LIKE '%dx%' AND deleted_at IS NULL`,
      [keep.id],
    );
    if (!existingDx) {
      // Prefer rehoming DX's own variants; if none, create a DX row from its price.
      const dxVars = await db.all<any>(
        `SELECT * FROM product_variants WHERE product_id = ? AND deleted_at IS NULL ORDER BY sort_order, price`,
        [dx.id],
      );
      if (dxVars.length) {
        for (const v of dxVars) {
          const nm = /dx/i.test(v.name) ? v.name : `DX ${v.name}`.trim();
          await db.run(
            `UPDATE product_variants SET product_id = ?, name = ?, updated_at = ? WHERE id = ?`,
            [keep.id, nm, nowIso(), v.id],
          );
          await db.run(`UPDATE bike_specs SET product_id = ? WHERE variant_id = ?`, [keep.id, v.id]).catch(() => undefined);
        }
      } else {
        await db.run(
          `INSERT INTO product_variants (id, product_id, name, price, on_road_price, status, is_base, sort_order, created_at, updated_at)
           VALUES (?, ?, 'DX', ?, NULL, 'active', 0, 10, ?, ?)`,
          [uid('var'), keep.id, dx.price_min, nowIso(), nowIso()],
        );
      }
    }
    // Ensure keep also has a Standard/base variant if it had none.
    const baseVar = await db.get<any>(
      `SELECT id FROM product_variants WHERE product_id = ? AND deleted_at IS NULL AND (is_base = 1 OR LOWER(name) IN ('standard','base','drum','kick')) LIMIT 1`,
      [keep.id],
    );
    if (!baseVar) {
      const anyVar = await db.get<any>(
        `SELECT id FROM product_variants WHERE product_id = ? AND deleted_at IS NULL LIMIT 1`,
        [keep.id],
      );
      if (!anyVar && keep.price_min != null) {
        await db.run(
          `INSERT INTO product_variants (id, product_id, name, price, status, is_base, sort_order, created_at, updated_at)
           VALUES (?, ?, 'Standard', ?, 'active', 1, 0, ?, ?)`,
          [uid('var'), keep.id, keep.price_min, nowIso(), nowIso()],
        );
      }
    }
    await rehomeChildren(keep.id, dx.id);
    await unpublish(dx.id, `dedupe: Shine 100 DX folded into ${keep.slug} as variant`);
  }

  await syncProductIdPrices(keep.id).catch(() => undefined);
}

/** Strip leading brand from every live product name (Hero Xtreme → Xtreme, etc.). */
async function stripBrandFromNames(limit = 500) {
  const rows = await db.all<ProductRow>(
    `SELECT p.id, p.name, p.slug, p.brand_id, p.status, p.price_min, p.price_max, p.deleted_at,
            b.slug AS brand_slug, b.name AS brand_name
       FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.deleted_at IS NULL
      LIMIT ?`,
    [limit],
  );
  for (const p of rows) {
    const clean = cleanModelName(p.brand_name, p.name);
    if (!clean || clean === p.name) continue;
    // Only rename the display name — do not touch slug here (would break
    // existing inbound links). Slug cleanup is left to the admin later.
    await db.run(`UPDATE products SET name = ?, updated_at = ? WHERE id = ?`, [clean, nowIso(), p.id]);
  }
}

/**
 * Run the full catalogue cleanup. Returns a short human summary.
 * Never throws to the caller — logs and returns the error string instead,
 * so a bad cleanup can never take down page loads.
 */
export async function runCatalogueCleanup(): Promise<string> {
  const notes: string[] = [];
  try {
    for (const pair of DUPLICATE_PAIRS) {
      try {
        await mergeDuplicatePair(pair);
        notes.push(`pair ${pair.brand}/${pair.keep}`);
      } catch (e) {
        notes.push(`pair ${pair.keep} FAILED: ${e instanceof Error ? e.message : e}`);
      }
    }
    try {
      await consolidateShine100();
      notes.push('shine-100');
    } catch (e) {
      notes.push(`shine-100 FAILED: ${e instanceof Error ? e.message : e}`);
    }
    try {
      await stripBrandFromNames();
      notes.push('strip-brand-names');
    } catch (e) {
      notes.push(`strip-brand-names FAILED: ${e instanceof Error ? e.message : e}`);
    }
    return `ok: ${notes.join('; ')}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[catalogue-cleanup]', msg);
    return `failed: ${msg}`;
  }
}

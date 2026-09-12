import { NextRequest } from 'next/server';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail } from '@/lib/api';
import { runCatalogueCleanup } from '@/lib/catalogue-cleanup';
import { audit } from '@/lib/audit';
import { db, nowIso, uid } from '@/lib/db';

/**
 * POST /api/admin/catalogue-cleanup
 *
 * Manually re-run the duplicate-product cleanup (safe / idempotent).
 * Also clears the one-shot schema_migrations marker so the job can run
 * again on the next cold start if you prefer the automatic path.
 *
 * Body (optional): { "force": true } — delete the migration marker first.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('product.write');
    let force = false;
    try {
      const body = await req.json();
      force = !!body?.force;
    } catch { /* empty body is fine */ }

    if (force) {
      await db.run(`DELETE FROM schema_migrations WHERE name = ?`, ['rt_catalogue_dedupe_2026_09']).catch(() => undefined);
    }

    const summary = await runCatalogueCleanup();

    // Mark done so the boot-time job does not re-run on every cold start.
    await db.run(
      `INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)`,
      [uid('mig'), 'rt_catalogue_dedupe_2026_09', nowIso()],
    ).catch(async () => {
      // Already present — fine.
      await db.run(
        `UPDATE schema_migrations SET applied_at = ? WHERE name = ?`,
        [nowIso(), 'rt_catalogue_dedupe_2026_09'],
      ).catch(() => undefined);
    });

    await audit(user, 'catalogue.cleanup', 'products', undefined, { summary });
    return ok({ summary }, 'Catalogue cleanup finished');
  } catch (e) {
    return handleError(e);
  }
}

export async function GET() {
  try {
    await requirePermission('product.write');
    // Report current live state of the known duplicate slugs so admin can verify.
    const rows = await db.all<any>(
      `SELECT p.id, p.name, p.slug, p.status, p.deleted_at, p.price_min, p.price_max,
              b.slug AS brand_slug, b.name AS brand_name,
              (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id AND v.deleted_at IS NULL) AS variant_count
         FROM products p JOIN brands b ON b.id = p.brand_id
        WHERE b.slug IN ('tvs','royal-enfield','honda')
          AND (
            LOWER(p.slug) IN (
              'raider-125','tvs-raider-125',
              'hunter-350','royal-enfield-hunter-350',
              'sport','tvs-sport',
              'shine100','honda-shine-100','shine-100',
              'honda-shine-100-dx','shine-100-dx'
            )
            OR p.slug LIKE '%-deduped-%'
            OR LOWER(REPLACE(p.name,' ','')) IN (
              'shine100','tvsraider125','raider125','hunter350','sport',
              'shine100dx','hondashine100','hondashine100dx'
            )
          )
        ORDER BY b.slug, CASE WHEN p.deleted_at IS NULL THEN 0 ELSE 1 END, p.slug`,
    );
    return ok({ rows });
  } catch (e) {
    return handleError(e);
  }
}

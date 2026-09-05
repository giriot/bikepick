import { db } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, fail } from '@/lib/api';
import { BIKE_SPEC_KEYS, EV_SPEC_KEYS } from '@/lib/spec-fields';

export const dynamic = 'force-dynamic';

/**
 * The whole catalogue as ONE spreadsheet: one row per model, every
 * specification column, so the gaps are obvious at a glance and the sheet can
 * be checked against OEM data offline. Mirrors the columns FullSpecSheet
 * renders on the public model page.
 *
 *   ?status=published|draft|all   default all (soft-deleted always excluded)
 *   ?onlygaps=1                   only rows that still have empty fields
 */
export async function GET(req: Request) {
  try {
    await requirePermission('product.write');
    const sp = new URL(req.url).searchParams;
    const status = sp.get('status') || 'all';
    if (!['all', 'published', 'draft'].includes(status)) return fail('status must be all, published or draft', 422);

    const where: string[] = ['p.deleted_at IS NULL'];
    const params: (string | number)[] = [];
    if (status !== 'all') { where.push('p.status = ?'); params.push(status); }

    const products = await db.all<any>(
      `SELECT p.id, p.name, b.name AS brand, p.slug, p.status, p.fuel_type, p.model_year,
              p.price_min, p.price_max, p.verification_status, p.pros, p.cons, p.best_for
         FROM products p
         JOIN brands b ON b.id = p.brand_id
        WHERE ${where.join(' AND ')}
        ORDER BY b.name, p.name`,
      params,
    );

    // One query per spec table rather than one per product.
    const ids = products.map((p) => p.id);
    const specBy = new Map<string, Record<string, unknown>>();
    if (ids.length) {
      const ph = ids.map(() => '?').join(',');
      for (const [table, keys] of [['bike_specs', BIKE_SPEC_KEYS], ['ev_specs', EV_SPEC_KEYS]] as const) {
        const rows = await db.all<any>(
          `SELECT product_id, ${keys.join(', ')} FROM ${table}
            WHERE variant_id IS NULL AND product_id IN (${ph})`,
          ids,
        );
        for (const r of rows) specBy.set(r.product_id, { ...(specBy.get(r.product_id) || {}), ...r });
      }
    }

    const specKeys = [...BIKE_SPEC_KEYS, ...EV_SPEC_KEYS.filter((k) => !(BIKE_SPEC_KEYS as readonly string[]).includes(k))];
    const header = ['brand', 'model', 'slug', 'status', 'fuel_type', 'model_year', 'price_min', 'price_max',
                    'verification_status', 'missing_count', 'missing_fields', ...specKeys];

    const onlyGaps = sp.get('onlygaps') === '1';
    const body: string[][] = [];
    for (const p of products) {
      const spec = specBy.get(p.id) || {};
      const missing = specKeys.filter((k) => spec[k] === null || spec[k] === undefined);
      if (onlyGaps && !missing.length) continue;
      body.push([
        p.brand, p.name, p.slug, p.status, p.fuel_type ?? '', p.model_year ?? '',
        p.price_min ?? '', p.price_max ?? '', p.verification_status ?? '',
        String(missing.length), missing.join('|'),
        ...specKeys.map((k) => spec[k] ?? ''),
      ]);
    }

    const csv = [header, ...body].map((cells) => cells.map(escapeCell).join(',')).join('\r\n');
    const name = `bikepick-spec-sheet-${status}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(`\uFEFF${csv}\r\n`, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${name}"`,
        'cache-control': 'no-store',
        'x-row-count': String(body.length),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** RFC 4180 quoting; also defuses spreadsheet formula injection on untrusted text. */
function escapeCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { getResource } from '@/lib/admin-config';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { BIKE_SPEC_KEYS, EV_SPEC_KEYS, NUMERIC_BIKE, NUMERIC_EV, BOOL_BIKE, BOOL_EV } from '@/lib/spec-fields';

export const dynamic = 'force-dynamic';

const INT = new Set(['max_power_rpm', 'max_torque_rpm', 'fast_charge_time_min', 'service_interval_km']);

/**
 * Saves the dropdown-based spec sheet for a product — model level
 * (variant_id NULL) or per-variant (body.variant_id).
 * Petrol products -> bike_specs, electric products -> ev_specs.
 * Only known columns are written; blank values store NULL (shown as N/A
 * on the site — we never guess).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const resource = getResource('products');
    if (!resource) return fail('Unknown section', 404);
    const user = await requirePermission(resource.permission);

    const product = await db.get<any>(
      'SELECT id, name, fuel_type FROM products WHERE id = ? AND deleted_at IS NULL',
      [params.id],
    );
    if (!product) return fail('Product not found', 404);

    const body = await readJson(req);
    const variantId = body.variant_id ? String(body.variant_id) : null;
    if (variantId) {
      const v = await db.get<any>(
        'SELECT id, name FROM product_variants WHERE id = ? AND product_id = ? AND deleted_at IS NULL',
        [variantId, product.id],
      );
      if (!v) return fail('Variant does not belong to this product', 422);
    }

    const isEv = product.fuel_type === 'electric';
    const table = isEv ? 'ev_specs' : 'bike_specs';
    const cols = (isEv ? EV_SPEC_KEYS : BIKE_SPEC_KEYS) as readonly string[];
    const REAL = isEv ? NUMERIC_EV : NUMERIC_BIKE;
    const BOOL = isEv ? BOOL_EV : BOOL_BIKE;

    const data: Record<string, any> = {};
    for (const c of cols) {
      const v = body[c];
      if (v === undefined) continue;
      if (v === '' || v === null || (typeof v === 'string' && v.trim().toLowerCase() === 'null')) { data[c] = null; continue; }
      if (REAL.has(c)) data[c] = Number(v) > 0 ? Number(v) : null;
      else if (BOOL.has(c)) data[c] = v === true || v === 1 || v === 'on' ? 1 : 0;
      else if (INT.has(c)) { const n = Number(v); data[c] = Number.isFinite(n) && n > 0 ? Math.round(n) : null; }
      else data[c] = String(v).slice(0, 300);
    }
    // extras: free-form spec fields listed by the OEM that have no standard column
    if (body.extras !== undefined) {
      const src = body.extras && typeof body.extras === 'object' ? body.extras : {};
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(src)) {
        const key = String(k).trim().slice(0, 40);
        const val = String(v ?? '').trim().slice(0, 120);
        if (key && val) out[key] = val;
      }
      data.extras = Object.keys(out).length ? JSON.stringify(out) : null;
    }

    const keys = Object.keys(data);
    if (!keys.length) return ok({ id: product.id, fields: 0 }, 'No changes');

    const now = nowIso();
    const existing = await db.get<any>(
      `SELECT id FROM ${table} WHERE product_id = ? AND ${variantId ? 'variant_id = ?' : 'variant_id IS NULL'}`,
      variantId ? [product.id, variantId] : [product.id],
    );
    if (existing) {
      await db.run(
        `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...keys.map((k) => data[k]), now, existing.id],
      );
    } else {
      const rowId = variantId
        ? 'spv_' + variantId.slice(-12)
        : 'spk_' + product.id.slice(-12);
      await db.run(
        `INSERT INTO ${table} (id, product_id, variant_id, ${keys.join(', ')}, created_at, updated_at)
         VALUES (?, ?, ?, ${keys.map(() => '?').join(', ')}, ?, ?)`,
        [rowId, product.id, variantId, ...keys.map((k) => data[k]), now, now],
      );
    }

    await audit(user, 'product.specs.update', table, product.id, {
      model: product.name,
      variant: variantId,
      fields: keys.length,
    });
    return ok({ id: product.id, table, variant_id: variantId, fields: keys.length }, variantId ? 'Variant spec saved' : 'Spec sheet saved');
  } catch (e) {
    return handleError(e);
  }
}

import 'server-only';
import { db, insert, nowIso, uid } from './db';
import { slugify, normalizeKey } from './slug';
import { getImportType, type ImportType } from './import-schema';
import type { AppUser } from '@/types';

export type RowAction = 'create' | 'update' | 'unchanged' | 'error';

export interface RowPlan {
  index: number;
  action: RowAction;
  label: string;
  changes: { field: string; from: any; to: any }[];
  errors: string[];
  existingId?: string;
  /** True when the row maps to a soft-deleted product that should be restored. */
  restore?: boolean;
  data: Record<string, any>;
}

export interface ImportPlan {
  type: string;
  totals: { total: number; create: number; update: number; unchanged: number; error: number };
  rows: RowPlan[];
  unknownColumns: string[];
}

const numeric = (v: string) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).replace(/[, ₹]/g, ''));
  return Number.isNaN(n) ? undefined : n; // undefined signals "invalid"
};

/**
 * Builds a preview of exactly what an import would do — per row, per field —
 * without writing anything. The same plan is then executed on confirmation, so
 * what the owner approves is what happens.
 */
export async function planImport(typeKey: string, rows: Record<string, string>[], headers: string[]): Promise<ImportPlan> {
  const type = getImportType(typeKey);
  if (!type) throw new Error('Unknown import type');

  const known = new Set(type.columns.map((c) => c.name));
  const unknownColumns = headers.filter((h) => h && !known.has(h));
  const plans: RowPlan[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const errors: string[] = [];
    const data: Record<string, any> = {};

    for (const col of type.columns) {
      const value = raw[col.name] ?? '';
      if (col.required && value === '') { errors.push(`${col.name} is required`); continue; }
      if (value === '') { data[col.name] = null; continue; }

      if (col.type === 'number') {
        const n = numeric(value);
        if (n === undefined) { errors.push(`${col.name} must be a number ("${value}")`); continue; }
        data[col.name] = n;
      } else if (col.type === 'enum') {
        if (col.options && !col.options.includes(value)) { errors.push(`${col.name} must be one of ${col.options.join(', ')}`); continue; }
        data[col.name] = value;
      } else if (col.type === 'bool') {
        data[col.name] = ['1', 'true', 'yes', 'y'].includes(value.toLowerCase()) ? 1 : 0;
      } else data[col.name] = value;
    }

    const label = type.matchOn.map((k) => raw[k] || '').filter(Boolean).join(' ') || `Row ${i + 2}`;
    const dedupeKey = type.matchOn.map((k) => (raw[k] || '').toLowerCase()).join('|');
    if (seen.has(dedupeKey)) errors.push('Duplicate of an earlier row in this file');
    seen.add(dedupeKey);

    if (errors.length) { plans.push({ index: i, action: 'error', label, changes: [], errors, data }); continue; }

    const existing = await findExisting(type, data);
    if (!existing) {
      // A previously soft-deleted product still occupies the unique
      // normalized_key index, so a plain INSERT would violate it. Point the
      // plan at that row so apply can restore it instead of failing.
      let restoreId: string | undefined;
      let restore = false;
      if (type.key === 'products') {
        const ghost = await db.get<any>(
          'SELECT id FROM products WHERE normalized_key = ? AND deleted_at IS NOT NULL LIMIT 1',
          [normalizeKey(data.brand, data.name)],
        );
        if (ghost) { restoreId = ghost.id; restore = true; }
      }
      plans.push({ index: i, action: 'create', label, changes: [], errors: [], data, existingId: restoreId, restore });
      continue;
    }

    const changes = await diffAgainstExisting(type, existing, data);
    plans.push({
      index: i, label, existingId: existing.id, data, errors: [],
      action: changes.length ? 'update' : 'unchanged', changes,
    });
  }

  return {
    type: typeKey,
    unknownColumns,
    rows: plans,
    totals: {
      total: plans.length,
      create: plans.filter((p) => p.action === 'create').length,
      update: plans.filter((p) => p.action === 'update').length,
      unchanged: plans.filter((p) => p.action === 'unchanged').length,
      error: plans.filter((p) => p.action === 'error').length,
    },
  };
}

async function findExisting(type: ImportType, data: Record<string, any>) {
  if (type.key === 'products' || type.key === 'prices') {
    return db.get<any>('SELECT * FROM products WHERE normalized_key = ? AND deleted_at IS NULL',
      [normalizeKey(data.brand, data.name)]);
  }
  if (type.key === 'dealers') {
    return db.get<any>('SELECT * FROM dealer_profiles WHERE LOWER(business_name) = ? AND LOWER(city) = ? AND deleted_at IS NULL',
      [String(data.business_name).toLowerCase(), String(data.city || '').toLowerCase()]);
  }
  return db.get<any>('SELECT * FROM service_centres WHERE LOWER(name) = ? AND LOWER(city) = ? AND deleted_at IS NULL',
    [String(data.name).toLowerCase(), String(data.city || '').toLowerCase()]);
}

const PRODUCT_SPEC_FIELDS = ['engine_capacity_cc', 'max_power_bhp', 'max_torque_nm', 'mileage_kmpl', 'fuel_tank_l', 'kerb_weight_kg', 'seat_height_mm', 'abs_type', 'top_speed_kmph'];
const EV_SPEC_FIELDS = ['battery_capacity_kwh', 'claimed_range_km', 'real_world_range_km', 'motor_power_kw', 'top_speed_kmph'];

async function diffAgainstExisting(type: ImportType, existing: any, data: Record<string, any>) {
  const changes: { field: string; from: any; to: any }[] = [];
  const compare = (field: string, from: any, to: any) => {
    if (to === null || to === undefined) return;              // never overwrite with blank
    if (String(from ?? '') === String(to)) return;
    changes.push({ field, from: from ?? null, to });
  };

  if (type.key === 'prices') {
    compare('price_min', existing.price_min, data.price);
    return changes;
  }
  if (type.key !== 'products') {
    for (const [k, v] of Object.entries(data)) compare(k, existing[k], v);
    return changes;
  }

  for (const f of ['fuel_type', 'body_type', 'price_min', 'price_max', 'model_year', 'status']) compare(f, existing[f], data[f]);

  const specTable = data.fuel_type === 'electric' || existing.fuel_type === 'electric' ? 'ev_specs' : 'bike_specs';
  const fields = specTable === 'ev_specs' ? EV_SPEC_FIELDS : PRODUCT_SPEC_FIELDS;
  const spec = await db.get<any>(`SELECT * FROM ${specTable} WHERE product_id = ? AND variant_id IS NULL`, [existing.id]);
  for (const f of fields) compare(f, spec?.[f], data[f]);
  return changes;
}

/** Applies a previously computed plan. Rows with errors are always skipped. */
export async function applyImport(typeKey: string, plan: ImportPlan, user: AppUser, filename: string) {
  const type = getImportType(typeKey)!;
  let created = 0, updated = 0, skipped = 0;
  const failures: string[] = [];

  const jobId = await insert('data_import_jobs', {
    id: uid('imp'), filename, job_type: typeKey, started_by: user.id,
    rows_total: plan.totals.total, rows_valid: plan.totals.create + plan.totals.update,
    rows_invalid: plan.totals.error, rows_duplicate: plan.totals.unchanged,
    rows_imported: 0, status: 'running',
  });

  for (const row of plan.rows) {
    if (row.action === 'error' || row.action === 'unchanged') { skipped++; continue; }
    try {
      if (typeKey === 'products') await applyProduct(row, user);
      else if (typeKey === 'prices') await applyPrice(row);
      else if (typeKey === 'dealers') await applyDealer(row);
      else await applyServiceCentre(row);
      if (row.action === 'create') created++; else updated++;
    } catch (e) {
      skipped++;
      failures.push(`${row.label}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  await db.run(
    'UPDATE data_import_jobs SET rows_imported=?, rows_duplicate=?, status=?, report=?, updated_at=? WHERE id=?',
    [created + updated, skipped, failures.length ? 'completed_with_errors' : 'completed',
     JSON.stringify({ created, updated, skipped, failures: failures.slice(0, 50) }), nowIso(), jobId],
  );

  return { jobId, created, updated, skipped, failures };
}

async function brandIdFor(name: string) {
  const existing = await db.get<any>('SELECT id FROM brands WHERE LOWER(name) = ? AND deleted_at IS NULL', [name.toLowerCase()]);
  if (existing) return existing.id;
  return insert('brands', { id: uid('brd'), name, slug: slugify(name), logo_license: 'unknown' });
}

async function applyProduct(row: RowPlan, user: AppUser) {
  const d = row.data;
  const brandId = await brandIdFor(String(d.brand));
  const isEv = d.fuel_type === 'electric';
  let productId = row.existingId;

  // Resolve the real category from fuel + body type. The live categories are
  // motorcycle / scooter / electric-scooter / electric-motorcycle — a null
  // category_id makes the product invisible in /bikes and /electric listings.
  const catSlug =
    isEv
      ? d.body_type === 'scooter' ? 'electric-scooter' : 'electric-motorcycle'
      : d.body_type === 'scooter' ? 'scooter' : 'motorcycle';
  let category = await db.get<any>('SELECT id FROM categories WHERE slug = ?', [catSlug]);
  if (!category) category = await db.get<any>('SELECT id FROM categories WHERE active = 1 ORDER BY sort_order LIMIT 1');

  if (productId && row.restore) {
    // Restore a previously soft-deleted product (its normalized_key still
    // holds the unique index, so a plain INSERT would fail). Refresh the data
    // and bring it back without touching slug/normalized_key.
    await db.run(
      `UPDATE products SET brand_id = ?, category_id = ?, name = ?, fuel_type = ?, body_type = ?,
        model_year = ?, price_min = ?, price_max = ?, status = ?, verification_status = ?,
        deleted_at = NULL, updated_at = ? WHERE id = ?`,
      [brandId, category?.id || null, d.name, d.fuel_type, d.body_type,
       d.model_year, d.price_min, d.price_max, d.status || 'draft', 'admin_verified',
       nowIso(), productId],
    );
  } else if (!productId) {
    productId = await insert('products', {
      id: uid('prd'), brand_id: brandId, category_id: category?.id || null,
      name: d.name, slug: slugify(`${d.brand}-${d.name}`), normalized_key: normalizeKey(d.brand, d.name),
      fuel_type: d.fuel_type, body_type: d.body_type, model_year: d.model_year,
      price_min: d.price_min, price_max: d.price_max,
      status: d.status || 'draft', verification_status: 'admin_verified', is_demo: 0,
    });
  } else {
    const set: Record<string, any> = {};
    for (const c of row.changes) if (['fuel_type', 'body_type', 'price_min', 'price_max', 'model_year', 'status'].includes(c.field)) set[c.field] = c.to;
    if (Object.keys(set).length) {
      await db.run(
        `UPDATE products SET ${Object.keys(set).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...Object.values(set), nowIso(), productId],
      );
      // Keep a version snapshot so a bad import can be traced.
      await insert('product_versions', {
        id: uid('ver'), product_id: productId, created_by: user.id,
        model_year: d.model_year ?? new Date().getFullYear(),
        note: 'CSV import', snapshot: JSON.stringify(set),
      }).catch(() => undefined); // history is best-effort; never block the import
    }
  }

  const table = isEv ? 'ev_specs' : 'bike_specs';
  const fields = isEv ? EV_SPEC_FIELDS : PRODUCT_SPEC_FIELDS;
  const specData: Record<string, any> = {};
  for (const f of fields) if (d[f] !== null && d[f] !== undefined) specData[f] = d[f];

  if (Object.keys(specData).length) {
    const existingSpec = await db.get<any>(`SELECT id FROM ${table} WHERE product_id = ? AND variant_id IS NULL`, [productId]);
    if (existingSpec) {
      await db.run(
        `UPDATE ${table} SET ${Object.keys(specData).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...Object.values(specData), nowIso(), existingSpec.id],
      );
    } else {
      await insert(table, { id: uid('spc'), product_id: productId, variant_id: null, ...specData });
    }
  }

  if (d.price_min != null) await recordPrice(productId!, d.price_min, null, d.source_name || 'CSV import');
  await insert('product_sources', {
    id: uid('src'), product_id: productId, source_name: d.source_name || 'CSV import',
    field_scope: 'all', confidence: 50, extracted_at: nowIso(),
  }).catch(() => undefined);
}

async function applyPrice(row: RowPlan) {
  const d = row.data;
  if (!row.existingId) throw new Error('Model not found — import the product first');
  await recordPrice(row.existingId, d.price, d.city, d.source_name, d.price_type || 'ex_showroom');
  if ((d.price_type || 'ex_showroom') === 'ex_showroom') {
    await db.run('UPDATE products SET price_min = ?, updated_at = ? WHERE id = ?', [d.price, nowIso(), row.existingId]);
  }
}

async function recordPrice(productId: string, price: number, city: string | null, sourceName: string, priceType = 'ex_showroom') {
  const last = await db.get<any>(
    'SELECT price FROM price_history WHERE product_id = ? AND price_type = ? ORDER BY recorded_at DESC LIMIT 1',
    [productId, priceType],
  );
  if (last && Number(last.price) === Number(price)) return;
  await insert('price_history', {
    id: uid('prc'), product_id: productId, city: city || 'India', price, price_type: priceType,
    source_name: sourceName, verified: 1, recorded_at: nowIso(),
  });
}

async function applyDealer(row: RowPlan) {
  const d = row.data;
  if (row.existingId) {
    const set: Record<string, any> = {};
    for (const c of row.changes) set[c.field] = c.to;
    delete set.brand;
    if (Object.keys(set).length) {
      await db.run(`UPDATE dealer_profiles SET ${Object.keys(set).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...Object.values(set), nowIso(), row.existingId]);
    }
    return;
  }
  await insert('dealer_profiles', {
    id: uid('dlr'), user_id: null, business_name: d.business_name, dealer_name: d.dealer_name,
    phone: d.phone, email: d.email, address: d.address, city: d.city, state: d.state,
    pincode: d.pincode, gstin: d.gstin, status: 'pending', is_demo: 0,
  });
}

async function applyServiceCentre(row: RowPlan) {
  const d = row.data;
  const brandId = d.brand ? await brandIdFor(String(d.brand)) : null;
  if (row.existingId) {
    const set: Record<string, any> = {};
    for (const c of row.changes) if (c.field !== 'brand') set[c.field] = c.to;
    if (brandId) set.brand_id = brandId;
    if (Object.keys(set).length) {
      await db.run(`UPDATE service_centres SET ${Object.keys(set).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
        [...Object.values(set), nowIso(), row.existingId]);
    }
    return;
  }
  await insert('service_centres', {
    id: uid('svc'), name: d.name, brand_id: brandId, phone: d.phone, address: d.address,
    city: d.city, state: d.state, pincode: d.pincode, services: d.services,
    verified: 0, status: 'active', is_demo: 0,
  });
}

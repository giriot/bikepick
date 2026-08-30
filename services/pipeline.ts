import 'server-only';
import { db, insert, nowIso, uid } from '@/lib/db';
import { normalizeKey, slugify } from '@/lib/slug';

/**
 * Data ingestion pipeline
 * -----------------------
 * FETCH → NORMALIZE → MATCH → DUPLICATE CHECK → VALIDATE → CHANGE DETECTION
 *       → CONFIDENCE → ADMIN REVIEW → PUBLISH
 *
 * Safety rules enforced here (not left to the caller):
 *  - A failing source NEVER deletes or blanks existing data.
 *  - Automation never overwrites admin-verified fields directly; it raises a
 *    pending data_change_log entry for a human decision.
 *  - Missing values stay NULL. Nothing is guessed or interpolated.
 *  - Every accepted value keeps its source, URL, extraction date, confidence.
 */

export type SourceTrust = 'manufacturer' | 'partner_feed' | 'verified_source' | 'admin_verified' | 'approved_secondary';

/** Higher wins when two sources disagree (section 89 priority order). */
export const TRUST_PRIORITY: Record<SourceTrust, number> = {
  manufacturer: 100,
  partner_feed: 80,
  verified_source: 60,
  admin_verified: 50,
  approved_secondary: 30,
};

export interface RawRecord {
  brand: string;
  model: string;
  variant?: string;
  category?: string;
  model_year?: string | number;
  fuel_type?: string;
  body_type?: string;
  price?: string | number;
  [key: string]: unknown;
}

export interface NormalizedRecord {
  brand: string;
  model: string;
  variant: string | null;
  categorySlug: string;
  fuelType: string;
  bodyType: string | null;
  modelYear: number | null;
  price: number | null;
  normalizedKey: string;
  specs: Record<string, number | string | null>;
  raw: RawRecord;
}

export interface RowIssue { row: number; field: string; message: string; severity: 'error' | 'warning' }

export interface PipelineResult {
  total: number;
  valid: NormalizedRecord[];
  invalid: { row: number; record: RawRecord; issues: RowIssue[] }[];
  duplicates: { row: number; record: NormalizedRecord; matchedProductId: string; matchedName: string }[];
  changes: PendingChange[];
  warnings: string[];
}

export interface PendingChange {
  productId: string;
  productName: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  confidence: number;
}

/* ------------------------------- NORMALIZE ------------------------------- */

const NUMERIC_FIELDS = new Set([
  'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l', 'length_mm', 'width_mm', 'height_mm',
  'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg', 'service_interval_km',
  'est_service_cost', 'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh',
  'claimed_range_km', 'real_world_range_km', 'charging_time_hours', 'fast_charge_time_min',
  'running_cost_per_km', 'est_battery_replacement_cost',
]);

const BOOLEAN_FIELDS = new Set([
  'cbs', 'traction_control', 'drl', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start',
  'cruise_control', 'hill_hold', 'reverse_mode', 'fast_charging', 'home_charging',
  'portable_charger', 'regen_braking',
]);

export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const cleaned = String(v).replace(/[₹,\s]/g, '').replace(/[a-zA-Z/%]+$/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseBool(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['1', 'yes', 'y', 'true', 'available', 'standard'].includes(s)) return 1;
  if (['0', 'no', 'n', 'false', 'na', 'not available', '-'].includes(s)) return 0;
  return null;
}

export function normalizeRecord(raw: RawRecord): NormalizedRecord {
  const brand = String(raw.brand || '').trim();
  const model = String(raw.model || '').trim();
  const fuelRaw = String(raw.fuel_type || 'petrol').trim().toLowerCase();
  const fuelType = /electric|ev|battery/.test(fuelRaw) ? 'electric' : 'petrol';
  const specs: Record<string, number | string | null> = {};

  for (const [k, v] of Object.entries(raw)) {
    if (['brand', 'model', 'variant', 'category', 'model_year', 'fuel_type', 'body_type', 'price'].includes(k)) continue;
    if (v === '' || v === null || v === undefined) { specs[k] = null; continue; } // MISSING STAYS NULL
    if (NUMERIC_FIELDS.has(k)) specs[k] = parseNumber(v);
    else if (BOOLEAN_FIELDS.has(k)) specs[k] = parseBool(v);
    else specs[k] = String(v).trim();
  }

  return {
    brand,
    model,
    variant: raw.variant ? String(raw.variant).trim() : null,
    categorySlug: String(raw.category || (fuelType === 'electric' ? 'electric' : 'bikes')).trim().toLowerCase(),
    fuelType,
    bodyType: raw.body_type ? String(raw.body_type).trim().toLowerCase() : null,
    modelYear: parseNumber(raw.model_year) ?? null,
    price: parseNumber(raw.price),
    normalizedKey: normalizeKey(brand, model),
    specs,
    raw,
  };
}

/* -------------------------------- VALIDATE ------------------------------- */

export function validateRecord(rec: NormalizedRecord, rowIndex: number): RowIssue[] {
  const issues: RowIssue[] = [];
  if (!rec.brand) issues.push({ row: rowIndex, field: 'brand', message: 'Brand is required', severity: 'error' });
  if (!rec.model) issues.push({ row: rowIndex, field: 'model', message: 'Model is required', severity: 'error' });
  if (rec.price !== null && (rec.price < 1000 || rec.price > 10_000_000)) {
    issues.push({ row: rowIndex, field: 'price', message: 'Price looks out of range for a two-wheeler', severity: 'error' });
  }
  if (rec.modelYear !== null && (rec.modelYear < 1990 || rec.modelYear > new Date().getFullYear() + 2)) {
    issues.push({ row: rowIndex, field: 'model_year', message: 'Model year is implausible', severity: 'error' });
  }
  const cc = rec.specs.engine_capacity_cc;
  if (rec.fuelType === 'petrol' && typeof cc === 'number' && (cc < 40 || cc > 2500)) {
    issues.push({ row: rowIndex, field: 'engine_capacity_cc', message: 'Displacement out of plausible range', severity: 'error' });
  }
  const mileage = rec.specs.mileage_kmpl;
  if (typeof mileage === 'number' && mileage > 150) {
    issues.push({ row: rowIndex, field: 'mileage_kmpl', message: 'Mileage above 150 kmpl requires manual confirmation', severity: 'warning' });
  }
  if (rec.fuelType === 'electric' && rec.specs.claimed_range_km === null) {
    issues.push({ row: rowIndex, field: 'claimed_range_km', message: 'EV has no claimed range — field left empty, not guessed', severity: 'warning' });
  }
  return issues;
}

/* --------------------------- MATCH + DUPLICATES -------------------------- */

export interface ExistingProduct { id: string; name: string; normalized_key: string; brand_name: string }

/**
 * Duplicate detection: "MT15", "MT 15", "MT-15" and "Yamaha MT15" all collapse
 * to the same normalized key, so a re-import updates rather than duplicates.
 */
export function findMatch(rec: NormalizedRecord, existing: ExistingProduct[]): ExistingProduct | null {
  const exact = existing.find((p) => p.normalized_key === rec.normalizedKey);
  if (exact) return exact;
  const modelKey = normalizeKey(rec.model);
  const sameBrand = existing.filter((p) => normalizeKey(p.brand_name) === normalizeKey(rec.brand));
  const byModel = sameBrand.find((p) => normalizeKey(p.name) === modelKey);
  if (byModel) return byModel;
  const contained = sameBrand.find(
    (p) => normalizeKey(p.name).replace(/\d+$/, '') === modelKey.replace(/\d+$/, '') && normalizeKey(p.name).length > 3 && modelKey.length > 3 && (normalizeKey(p.name).includes(modelKey) || modelKey.includes(normalizeKey(p.name))),
  );
  return contained || null;
}

/* ------------------------------ CONFIDENCE ------------------------------- */

export function confidenceFor(rec: NormalizedRecord, trust: SourceTrust): number {
  const filled = Object.values(rec.specs).filter((v) => v !== null && v !== '').length;
  const completeness = Math.min(1, filled / 20);
  const base = TRUST_PRIORITY[trust] / 100;
  return Math.round((base * 0.7 + completeness * 0.3) * 100) / 100;
}

/* ------------------------------ CSV PARSING ------------------------------ */

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return {
    headers,
    rows: nonEmpty.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()]))),
  };
}

export const CSV_TEMPLATE_COLUMNS = [
  'brand', 'model', 'variant', 'category', 'model_year', 'fuel_type', 'body_type', 'price',
  'engine_type', 'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'transmission', 'clutch', 'gearbox', 'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l',
  'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg',
  'front_tyre', 'rear_tyre', 'front_brake', 'rear_brake', 'abs_type', 'cbs', 'traction_control',
  'suspension_front', 'suspension_rear', 'wheel_type', 'headlight', 'tail_light', 'drl',
  'instrument_cluster', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start', 'cruise_control',
  'ride_modes', 'hill_hold', 'reverse_mode', 'warranty', 'service_interval_km', 'est_service_cost', 'colours',
  'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'battery_chemistry', 'battery_warranty',
  'claimed_range_km', 'real_world_range_km', 'charging_time_hours', 'fast_charging', 'charging_connector',
  'home_charging', 'portable_charger', 'regen_braking', 'battery_ip_rating', 'motor_ip_rating',
];

export function csvTemplate(): string {
  const example = [
    'Yamaha', 'MT-15 V2', 'Standard', 'bikes', '2025', 'petrol', 'street', '169000',
    'Liquid-cooled, 4-stroke, SOHC, 4-valve', '155', '18.1', '10000', '14.1', '7500',
    '6-speed', 'Assist & Slipper', 'Constant mesh', '131', '45', '10',
    '1990', '790', '1070', '1325', '810', '170', '141',
    '100/80-17', '140/70-17', 'Disc', 'Disc', 'Dual channel', '0', '0',
    'Upside down forks', 'Monoshock', 'Alloy', 'LED', 'LED', '1',
    'Digital LCD', '1', '0', '0', '0', '0',
    '', '0', '0', '2 years / unlimited km', '5000', '900', 'Cyan Storm, Metallic Black',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
  ];
  return `${CSV_TEMPLATE_COLUMNS.join(',')}\n${example.join(',')}\n`;
}

/* -------------------------------- RUNNER --------------------------------- */

export interface RunOptions {
  sourceId?: string | null;
  sourceName: string;
  trust: SourceTrust;
  sourceUrl?: string | null;
  dryRun?: boolean;
  actorId?: string | null;
}

/**
 * Process normalized records against the live database.
 * dryRun = true powers the admin import PREVIEW (nothing is written).
 */
export async function processRecords(records: RawRecord[], opts: RunOptions): Promise<PipelineResult> {
  const existing = await db.all<ExistingProduct>(
    `SELECT p.id, p.name, p.normalized_key, b.name AS brand_name
       FROM products p JOIN brands b ON b.id = p.brand_id WHERE p.deleted_at IS NULL`,
  );

  const result: PipelineResult = { total: records.length, valid: [], invalid: [], duplicates: [], changes: [], warnings: [] };
  const seenKeys = new Set<string>();

  for (let i = 0; i < records.length; i++) {
    const rec = normalizeRecord(records[i]);
    const issues = validateRecord(rec, i + 2); // +2 = header row + 1-based
    const errors = issues.filter((x) => x.severity === 'error');
    if (errors.length) { result.invalid.push({ row: i + 2, record: records[i], issues }); continue; }
    result.warnings.push(...issues.filter((x) => x.severity === 'warning').map((x) => `Row ${x.row}: ${x.message}`));

    if (seenKeys.has(rec.normalizedKey)) {
      result.duplicates.push({ row: i + 2, record: rec, matchedProductId: '', matchedName: 'duplicate row inside this file' });
      continue;
    }
    seenKeys.add(rec.normalizedKey);

    const match = findMatch(rec, existing);
    if (match) {
      result.duplicates.push({ row: i + 2, record: rec, matchedProductId: match.id, matchedName: `${match.brand_name} ${match.name}` });
      const changes = await detectChanges(match.id, rec, opts);
      result.changes.push(...changes);
    } else {
      result.valid.push(rec);
    }
  }
  return result;
}

/** CHANGE DETECTION — never writes over verified data, queues a decision. */
export async function detectChanges(productId: string, rec: NormalizedRecord, opts: RunOptions): Promise<PendingChange[]> {
  const product = await db.get<any>('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) return [];
  const bike = await db.get<any>('SELECT * FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [productId]);
  const ev = await db.get<any>('SELECT * FROM ev_specs WHERE product_id = ? AND variant_id IS NULL', [productId]);
  const confidence = confidenceFor(rec, opts.trust);
  const out: PendingChange[] = [];

  const compare = (field: string, oldVal: any, newVal: any) => {
    if (newVal === null || newVal === undefined || newVal === '') return; // never blank existing data
    if (String(oldVal ?? '') === String(newVal)) return;
    out.push({
      productId, productName: `${product.name}`, field,
      oldValue: oldVal === null || oldVal === undefined ? null : String(oldVal),
      newValue: String(newVal), confidence,
    });
  };

  compare('price_min', product.price_min, rec.price);
  for (const [k, v] of Object.entries(rec.specs)) {
    if (bike && k in bike) compare(k, bike[k], v);
    else if (ev && k in ev) compare(k, ev[k], v);
  }

  if (!opts.dryRun) {
    for (const c of out) {
      await insert('data_change_logs', {
        id: uid('chg'), entity_type: 'product', entity_id: c.productId, field: c.field,
        old_value: c.oldValue, new_value: c.newValue, change_type: 'update',
        data_source_id: opts.sourceId || null, source_name: opts.sourceName,
        source_url: opts.sourceUrl || null, confidence: c.confidence, status: 'pending',
      });
    }
  }
  return out;
}

/** Create products from validated new records. Products land as DRAFT for review. */
export async function insertNewProducts(records: NormalizedRecord[], opts: RunOptions): Promise<{ created: number; productIds: string[] }> {
  const productIds: string[] = [];
  for (const rec of records) {
    const brandSlug = slugify(rec.brand);
    let brand = await db.get<any>('SELECT * FROM brands WHERE slug = ?', [brandSlug]);
    if (!brand) {
      const id = await insert('brands', {
        id: uid('brd'), name: rec.brand, slug: brandSlug,
        logo_license_status: 'not_provided', active: 1,
      });
      brand = { id };
    }
    const categorySlug = rec.fuelType === 'electric' ? 'electric' : 'bikes';
    const category = await db.get<any>('SELECT * FROM categories WHERE slug = ?', [categorySlug]);
    if (!category) continue;

    const productId = await insert('products', {
      id: uid('prd'),
      brand_id: brand.id,
      category_id: category.id,
      name: rec.model,
      slug: slugify(rec.model),
      normalized_key: rec.normalizedKey,
      model_year: rec.modelYear,
      fuel_type: rec.fuelType,
      body_type: rec.bodyType,
      price_min: rec.price,
      status: 'draft',
      verification_status: 'pending_review',
    });
    productIds.push(productId);

    const specEntries = Object.entries(rec.specs).filter(([, v]) => v !== null);
    if (rec.fuelType === 'electric') {
      await insert('ev_specs', { id: uid('evs'), product_id: productId, ...Object.fromEntries(specEntries.filter(([k]) => EV_KEYS.has(k))) });
      const bikeSide = Object.fromEntries(specEntries.filter(([k]) => BIKE_KEYS.has(k)));
      if (Object.keys(bikeSide).length) await insert('bike_specs', { id: uid('bks'), product_id: productId, ...bikeSide });
    } else {
      await insert('bike_specs', { id: uid('bks'), product_id: productId, ...Object.fromEntries(specEntries.filter(([k]) => BIKE_KEYS.has(k))) });
    }

    await insert('product_sources', {
      id: uid('src'), product_id: productId, data_source_id: opts.sourceId || null,
      source_name: opts.sourceName, source_url: opts.sourceUrl || null,
      field_scope: 'full_record', confidence: confidenceFor(rec, opts.trust), extracted_at: nowIso(),
    });
  }
  return { created: productIds.length, productIds };
}

export const BIKE_KEYS = new Set([
  'engine_type', 'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'transmission', 'clutch', 'gearbox', 'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l', 'length_mm',
  'width_mm', 'height_mm', 'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg',
  'front_tyre', 'rear_tyre', 'front_brake', 'rear_brake', 'abs_type', 'cbs', 'traction_control',
  'suspension_front', 'suspension_rear', 'wheel_type', 'headlight', 'tail_light', 'drl',
  'instrument_cluster', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start', 'cruise_control',
  'ride_modes', 'hill_hold', 'reverse_mode', 'warranty', 'service_interval_km', 'est_service_cost',
  'accessories', 'colours',
]);

export const EV_KEYS = new Set([
  'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'battery_chemistry',
  'battery_warranty', 'claimed_range_km', 'real_world_range_km', 'range_basis', 'charging_time_hours',
  'fast_charging', 'fast_charge_time_min', 'charging_connector', 'home_charging', 'portable_charger',
  'top_speed_kmph', 'regen_braking', 'ride_modes', 'battery_ip_rating', 'motor_ip_rating',
  'kerb_weight_kg', 'warranty', 'running_cost_per_km', 'est_battery_replacement_cost',
]);

/**
 * Execute a configured data source. Failure is recorded and surfaced to the
 * admin — existing product data is left untouched.
 */
export async function runDataSource(sourceId: string, actorId: string | null): Promise<{ ok: boolean; message: string; processed?: number }> {
  const source = await db.get<any>('SELECT * FROM data_sources WHERE id = ?', [sourceId]);
  if (!source) return { ok: false, message: 'Data source not found' };
  if (source.status === 'disabled') return { ok: false, message: 'Source is disabled' };

  const job = await insert('data_import_jobs', {
    id: uid('job'), data_source_id: sourceId, job_type: source.source_type,
    status: 'running', started_by: actorId,
  });

  try {
    if (source.source_type === 'manual' || !source.endpoint) {
      throw new Error('This source has no endpoint configured. Use Admin → Imports to upload a CSV/Excel file instead.');
    }
    const key = source.auth_env_key ? process.env[source.auth_env_key] : undefined;
    const res = await fetch(source.endpoint, {
      headers: key ? { authorization: `Bearer ${key}` } : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Source responded with HTTP ${res.status}`);
    const payload = (await res.json()) as { records?: RawRecord[] } | RawRecord[];
    const records = Array.isArray(payload) ? payload : payload.records || [];

    const out = await processRecords(records, {
      sourceId, sourceName: source.name, trust: source.trust_level as SourceTrust,
      sourceUrl: source.endpoint, actorId,
    });

    await db.run(
      `UPDATE data_sources SET last_success_at = ?, last_error = NULL, products_updated = products_updated + ?, updated_at = ? WHERE id = ?`,
      [nowIso(), out.changes.length, nowIso(), sourceId],
    );
    await db.run(
      `UPDATE data_import_jobs SET status = 'completed', rows_total = ?, rows_valid = ?, rows_invalid = ?, rows_duplicate = ?, report = ?, updated_at = ? WHERE id = ?`,
      [out.total, out.valid.length, out.invalid.length, out.duplicates.length, JSON.stringify({ warnings: out.warnings.slice(0, 50), changes: out.changes.length }), nowIso(), job],
    );
    return { ok: true, message: `Processed ${out.total} records — ${out.changes.length} changes queued for review`, processed: out.total };
  } catch (e) {
    const message = (e as Error).message;
    // RULE 42: never destroy existing data on failure.
    await db.run(
      `UPDATE data_sources SET last_failure_at = ?, last_error = ?, error_count = error_count + 1, updated_at = ? WHERE id = ?`,
      [nowIso(), message.slice(0, 500), nowIso(), sourceId],
    );
    await db.run(`UPDATE data_import_jobs SET status = 'failed', report = ?, updated_at = ? WHERE id = ?`, [
      JSON.stringify({ error: message }), nowIso(), job,
    ]);
    await insert('notifications', {
      id: uid('ntf'), user_id: actorId, channel: 'in_app', event_type: 'verification_result',
      title: `Data source unavailable: ${source.name}`,
      body: `${message} — existing product data was left unchanged.`,
      link: '/admin/data-sources', delivery_status: 'delivered',
    });
    return { ok: false, message };
  }
}

/** Apply an approved change to the live record. */
export async function applyChange(changeId: string, actorId: string): Promise<void> {
  const change = await db.get<any>('SELECT * FROM data_change_logs WHERE id = ?', [changeId]);
  if (!change || change.status !== 'pending') throw new Error('Change is not pending');
  const field = change.field;
  const value = change.new_value;

  if (change.entity_type === 'product') {
    if (field === 'price_min') {
      await db.run('UPDATE products SET price_min = ?, updated_at = ? WHERE id = ?', [Number(value), nowIso(), change.entity_id]);
      await insert('price_history', {
        id: uid('ph'), product_id: change.entity_id, price: Number(value),
        source_name: change.source_name, source_url: change.source_url,
        verified: 1, recorded_at: nowIso(),
      });
    } else if (BIKE_KEYS.has(field)) {
      const exists = await db.get<any>('SELECT id FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [change.entity_id]);
      if (exists) await db.run(`UPDATE bike_specs SET ${field} = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), exists.id]);
    } else if (EV_KEYS.has(field)) {
      const exists = await db.get<any>('SELECT id FROM ev_specs WHERE product_id = ? AND variant_id IS NULL', [change.entity_id]);
      if (exists) await db.run(`UPDATE ev_specs SET ${field} = ?, updated_at = ? WHERE id = ?`, [value, nowIso(), exists.id]);
    }
  }
  await db.run(`UPDATE data_change_logs SET status = 'approved', decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`, [
    actorId, nowIso(), nowIso(), changeId,
  ]);
}

import { describe, it, expect } from 'vitest';
import { db, insert } from '@/lib/db';
import { planImport, applyImport } from '@/lib/importer';
import { specSheetHeader, specSheetKeys } from '@/lib/spec-sheet';
import type { AppUser } from '@/lib/rbac';

/**
 * The spec sheet's whole point is that you can edit it and put it back, so this
 * drives the real import path with a sheet in the export's own column order and
 * asserts the properties that make that safe:
 *
 *   1. every spec column in the sheet is one the importer can store
 *   2. a filled cell reaches bike_specs
 *   3. re-importing an untouched row writes nothing
 *   4. a blank cell never wipes an existing value
 *
 * The product is created by the importer rather than hand-inserted, so the
 * normalized_key the planner matches on is the real one. Everything it makes is
 * removed again, so the dev database stays clean.
 */
const now = '2026-09-07T00:00:00.000Z';
const header = specSheetHeader();
const user = { id: 'usr_zz', email: 'sheettest@example.invalid', full_name: 'Harness', role: 'admin' } as unknown as AppUser;

function sheet(values: Record<string, string>): Record<string, string>[] {
  return [Object.fromEntries(header.map((h) => [h, values[h] ?? '']))];
}
const base = { brand: 'Sheet Test', name: 'Sheet Test 125', fuel_type: 'petrol', status: 'draft', source_name: 'round-trip harness' };

describe('spec sheet -> importer round trip', () => {
  it('creates, then updates, then reports unchanged', async () => {
    await db.run('DELETE FROM bike_specs WHERE product_id IN (SELECT id FROM products WHERE name = ?)', ['Sheet Test 125']);
    await db.run('DELETE FROM product_sources WHERE product_id IN (SELECT id FROM products WHERE name = ?)', ['Sheet Test 125']);
    await db.run('DELETE FROM products WHERE name = ?', ['Sheet Test 125']);
    await db.run('DELETE FROM brands WHERE name = ?', ['Sheet Test']);
    await db.run('DELETE FROM users WHERE id = ?', ['usr_zz']);
    await insert('users', { id: 'usr_zz', email: 'sheettest@example.invalid', full_name: 'Harness', role: 'admin', status: 'active', created_at: now, updated_at: now });

    // 1. create from a sheet with only the identifying columns
    const p1 = await planImport('products', sheet(base), header);
    expect(p1.totals.error).toBe(0);
    expect(p1.totals.create).toBe(1);
    const r1 = await applyImport('products', p1, user, 'create.csv');
    expect(r1.failures).toEqual([]);
    expect(r1.created).toBe(1);
    const pid = (await db.get<any>("SELECT id FROM products WHERE name = ?", ['Sheet Test 125']))!.id as string;

    // 2. same row again, now carrying the seven previously-ignored columns
    const filled = { ...base, service_interval_km: '3000', est_service_cost: '725', accessories: 'Engine Guard, Seat Cover',
                     mileage_kmpl: '61.2', top_speed_kmph: '97' };
    const p2 = await planImport('products', sheet(filled), header);
    expect(p2.totals.update).toBe(1);
    const fields = p2.rows[0].changes.map((c) => c.field);
    for (const f of ['service_interval_km', 'est_service_cost', 'accessories', 'mileage_kmpl']) {
      expect(fields, `${f} must be offered as a change`).toContain(f);
    }
    const r2 = await applyImport('products', p2, user, 'fill.csv');
    expect(r2.failures).toEqual([]);
    const spec1 = await db.get<any>('SELECT * FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [pid]);
    expect(Number(spec1.service_interval_km)).toBe(3000);
    expect(Number(spec1.est_service_cost)).toBe(725);
    expect(String(spec1.accessories)).toContain('Engine Guard');
    expect(Number(spec1.mileage_kmpl)).toBe(61.2);

    // 3. re-import untouched: nothing to write
    const p3 = await planImport('products', sheet(filled), header);
    expect(p3.totals.unchanged, JSON.stringify(p3.rows[0]?.errors)).toBe(1);
    expect(p3.totals.update).toBe(0);

    // 4. blank cells must not wipe existing values
    const p4 = await planImport('products', sheet({ ...base, top_speed_kmph: '97' }), header);
    const r4 = await applyImport('products', p4, user, 'blank.csv');
    expect(r4.failures).toEqual([]);
    const spec2 = await db.get<any>('SELECT * FROM bike_specs WHERE product_id = ? AND variant_id IS NULL', [pid]);
    expect(Number(spec2.service_interval_km), 'blank cell wiped a value').toBe(3000);
    expect(Number(spec2.mileage_kmpl)).toBe(61.2);
    expect(Number(spec2.top_speed_kmph)).toBe(97);

    // every sheet column is either importable or a declared helper
    const known = new Set((await import('@/lib/import-schema')).getImportType('products')!.columns.map((c) => c.name));
    const helpers = new Set(['slug', 'verification_status', 'missing_count', 'missing_fields']);
    expect(header.filter((h) => !known.has(h) && !helpers.has(h))).toEqual([]);
    expect(specSheetKeys().every((k) => known.has(k))).toBe(true);

    await db.run('DELETE FROM bike_specs WHERE product_id = ?', [pid]);
    await db.run('DELETE FROM product_sources WHERE product_id = ?', [pid]);
    await db.run('DELETE FROM data_import_jobs WHERE started_by = ?', ['usr_zz']);
    await db.run('DELETE FROM products WHERE id = ?', [pid]);
  }, 60_000);
});

/**
 * Integration test: runs the real planner against the real database.
 * It only PLANS (never applies), so the data file is left untouched.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { parseCsv } from '@/lib/csv';
import { planImport } from '@/lib/importer';

let sample: { brand: string; name: string; price_min: number | null } | null = null;

beforeAll(async () => {
  sample = await db.get<any>(
    `SELECT b.name AS brand, p.name, p.price_min FROM products p JOIN brands b ON b.id = p.brand_id
      WHERE p.deleted_at IS NULL AND p.price_min IS NOT NULL LIMIT 1`,
  );
});

const plan = (csv: string) => {
  const { headers, rows } = parseCsv(csv);
  return planImport('products', rows, headers);
};

describe('CSV import planning', () => {
  it('detects an existing model as an update, not a duplicate', async () => {
    expect(sample).toBeTruthy();
    const csv = `brand,name,fuel_type,price_min,source_name\n${sample!.brand},${sample!.name},petrol,${(sample!.price_min ?? 0) + 5000},Test\n`;
    const p = await plan(csv);
    expect(p.totals.create).toBe(0);
    expect(p.totals.update).toBe(1);
    expect(p.rows[0].changes.some((c) => c.field === 'price_min')).toBe(true);
  });

  it('reports an identical row as unchanged so nothing is rewritten', async () => {
    const csv = `brand,name,fuel_type,price_min,source_name\n${sample!.brand},${sample!.name},petrol,${sample!.price_min},Test\n`;
    const p = await plan(csv);
    expect(p.totals.unchanged).toBe(1);
    expect(p.totals.update).toBe(0);
  });

  it('matches across spelling variations of the same model', async () => {
    const spaced = sample!.name.replace(/-/g, ' ');
    const csv = `brand,name,fuel_type,price_min,source_name\n${sample!.brand},${spaced},petrol,${sample!.price_min},Test\n`;
    const p = await plan(csv);
    expect(p.totals.create).toBe(0);
  });

  it('treats an unknown model as a create', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name\nZzz Motors,Imaginary 999,petrol,100000,Test\n';
    const p = await plan(csv);
    expect(p.totals.create).toBe(1);
  });

  it('flags non-numeric prices instead of importing garbage', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name\nZzz Motors,Imaginary 998,petrol,about a lakh,Test\n';
    const p = await plan(csv);
    expect(p.totals.error).toBe(1);
    expect(p.rows[0].errors[0]).toMatch(/number/i);
  });

  it('rejects an invalid enum value', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name\nZzz Motors,Imaginary 997,diesel,100000,Test\n';
    const p = await plan(csv);
    expect(p.totals.error).toBe(1);
  });

  it('flags rows missing a required field', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name\n,No Brand,petrol,100000,Test\n';
    const p = await plan(csv);
    expect(p.rows[0].errors.join(' ')).toMatch(/required/);
  });

  it('detects duplicates inside the same file', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name\nZzz Motors,Imaginary 996,petrol,100000,Test\nZzz Motors,Imaginary 996,petrol,110000,Test\n';
    const p = await plan(csv);
    expect(p.rows[1].errors.join(' ')).toMatch(/duplicate/i);
  });

  it('reports unrecognised columns rather than silently dropping them', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name,colour\nZzz Motors,Imaginary 995,petrol,100000,Test,Blue\n';
    const p = await plan(csv);
    expect(p.unknownColumns).toContain('colour');
  });

  it('leaves blank optional cells as null instead of guessing a value', async () => {
    const csv = 'brand,name,fuel_type,price_min,source_name,mileage_kmpl\nZzz Motors,Imaginary 994,petrol,100000,Test,\n';
    const p = await plan(csv);
    expect(p.rows[0].data.mileage_kmpl).toBeNull();
  });

  it('writes nothing during planning', async () => {
    const before = await db.get<any>('SELECT COUNT(*) AS c FROM products');
    await plan('brand,name,fuel_type,price_min,source_name\nZzz Motors,Imaginary 993,petrol,100000,Test\n');
    const after = await db.get<any>('SELECT COUNT(*) AS c FROM products');
    expect(after.c).toBe(before.c);
  });
});

describe('Settings coverage', () => {
  it('has every default setting present in the database', async () => {
    const { DEFAULT_SETTINGS } = await import('@/lib/settings-defaults');
    const rows = await db.all<any>('SELECT key FROM settings');
    const have = new Set(rows.map((r) => r.key));
    const missing = Object.keys(DEFAULT_SETTINGS).filter((k) => !have.has(k));
    expect(missing).toEqual([]);
  });

  it('stores score weights that total 100', async () => {
    const row = await db.get<any>("SELECT value FROM settings WHERE key = 'score_weights'");
    const total = Object.values(JSON.parse(row.value) as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });
});

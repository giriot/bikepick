import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv } from '@/lib/csv';
import { IMPORT_TYPES, getImportType } from '@/lib/import-schema';

describe('CSV parsing', () => {
  it('parses a simple file into keyed rows', () => {
    const { headers, rows } = parseCsv('brand,name\nYamaha,MT-15\nHonda,SP 125\n');
    expect(headers).toEqual(['brand', 'name']);
    expect(rows).toHaveLength(2);
    expect(rows[1].name).toBe('SP 125');
  });

  it('handles quoted fields containing commas and quotes', () => {
    const { rows } = parseCsv('name,note\n"Classic 350","Chrome, ""Redditch"" edition"\n');
    expect(rows[0].note).toBe('Chrome, "Redditch" edition');
  });

  it('survives CRLF line endings and a BOM', () => {
    const { rows } = parseCsv('\uFEFFbrand,name\r\nTVS,Apache\r\n');
    expect(rows[0].brand).toBe('TVS');
  });

  it('ignores completely blank lines', () => {
    const { rows } = parseCsv('a,b\n1,2\n\n\n3,4\n');
    expect(rows).toHaveLength(2);
  });

  it('round-trips through toCsv', () => {
    const rows = [{ a: 'x,y', b: 'plain' }];
    const { rows: back } = parseCsv(toCsv(rows));
    expect(back[0]).toEqual(rows[0]);
  });
});

describe('Import schema', () => {
  it('declares match keys for every import type so re-imports update instead of duplicating', () => {
    for (const t of IMPORT_TYPES) {
      expect(t.matchOn.length).toBeGreaterThan(0);
      for (const key of t.matchOn) expect(t.columns.some((c) => c.name === key)).toBe(true);
    }
  });

  it('documents every column for the non-technical owner', () => {
    for (const t of IMPORT_TYPES) for (const c of t.columns) expect(c.help.length).toBeGreaterThan(5);
  });

  it('looks types up by key', () => {
    expect(getImportType('products')?.table).toBe('products');
    expect(getImportType('nope')).toBeUndefined();
  });
});

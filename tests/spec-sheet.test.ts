import { describe, it, expect } from 'vitest';
import { getImportType } from '@/lib/import-schema';
import {
  specSheetHeader, specSheetKeys, SPEC_SHEET_SOURCE, SPEC_SHEET_SHEET_ONLY, SPEC_SHEET_IMPORT_IGNORED,
} from '@/lib/spec-sheet';

/**
 * The spec sheet is only worth keeping if an edited copy can go straight back
 * through the bulk importer (/admin/import), so this pins the header against the
 * importer's own schema instead of a hand-written list that can drift.
 */
const type = getImportType('products');
if (!type) throw new Error('products import type vanished from lib/import-schema.ts');
const known = new Set(type.columns.map((c) => c.name));

describe('spec sheet <-> bulk importer round trip', () => {
  const header = specSheetHeader();

  it('supplies every column the importer marks required', () => {
    const required = type.columns.filter((c) => c.required).map((c) => c.name);
    expect(required).toContain('source_name');
    for (const col of required) {
      expect(header, `sheet is missing required importer column "${col}"`).toContain(col);
    }
  });

  it('matches on brand + name, never a renamed `model` column', () => {
    expect(type.matchOn).toEqual(['brand', 'name']);
    expect(header).toContain('name');
    expect(header).not.toContain('model');
  });

  it('carries a provenance value for anything re-imported', () => {
    expect(SPEC_SHEET_SOURCE).toMatch(/bikepick/);
    expect(header[header.indexOf('source_name')]).toBe('source_name');
  });

  it('only leaves the documented columns for the importer to ignore', () => {
    const unknown = header.filter((h) => !known.has(h));
    const sheetOnly = new Set<string>([...SPEC_SHEET_SHEET_ONLY, 'slug', 'verification_status']);
    const dropped = unknown.filter((h) => !sheetOnly.has(h));
    expect(dropped.sort()).toEqual([...SPEC_SHEET_IMPORT_IGNORED].sort());
  });

  it('keeps almost every spec field importable', () => {
    const importable = specSheetKeys().filter((k) => known.has(k));
    expect(importable.length).toBeGreaterThanOrEqual(specSheetKeys().length - SPEC_SHEET_IMPORT_IGNORED.length);
    expect(importable).toContain('mileage_kmpl');
    expect(importable).toContain('real_world_range_km');
  });

  it('lists every id column before the spec block, so the sheet opens sensibly', () => {
    const keys = specSheetKeys();
    const firstSpec = header.indexOf(keys[0]);
    expect(header.slice(0, firstSpec)).toEqual(expect.arrayContaining(['brand', 'name', 'fuel_type']));
    expect(header.slice(-keys.length)).toEqual(keys);
  });
});

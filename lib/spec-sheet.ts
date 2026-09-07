import { BIKE_SPEC_KEYS, EV_SPEC_KEYS } from '@/lib/spec-fields';

/**
 * Column order for the single-sheet spec export.
 *
 * This header is not free-form: the sheet is meant to survive a round trip
 * through the bulk importer (/admin/import -> lib/importer.ts), so it starts
 * with every column that importer declares `required` for `products` and reuses
 * its exact column names. `name`, not `model`, is what the importer matches
 * rows on (brand + name); renaming it here would make an edited sheet un-
 * importable, and `source_name` is required so the figures keep their provenance.
 *
 * The sheet-only columns at the end are deliberately extra: the importer reports
 * unrecognised headers as `unknownColumns` and ignores them, so "how complete is
 * this model" survives in the spreadsheet without polluting the database.
 */
export const SPEC_SHEET_ID_COLUMNS = [
  'brand', 'name', 'slug', 'status', 'fuel_type', 'model_year',
  'price_min', 'price_max', 'verification_status', 'source_name',
] as const;

/** Extra columns that exist to help a human editing the sheet. */
export const SPEC_SHEET_SHEET_ONLY = ['missing_count', 'missing_fields'] as const;

/**
 * Spec columns the bulk importer does not accept, so re-importing this sheet
 * leaves them alone. Six of these are exactly the figures the AI queue refuses
 * to auto-write (service cost, warranty, colours, running cost), which is the
 * right division of labour: the sheet carries them for reading, a human enters
 * them in the product form. Pinned by tests/spec-sheet.test.ts so a change to
 * either side shows up as a failing test rather than a silently dropped column.
 */
export const SPEC_SHEET_IMPORT_IGNORED = [
  'service_interval_km', 'est_service_cost', 'accessories',
  'range_basis', 'fast_charge_time_min', 'running_cost_per_km', 'est_battery_replacement_cost',
] as const;

/** Provenance recorded for anything that came back in through this sheet. */
export const SPEC_SHEET_SOURCE = 'bikepick.in spec sheet export';

/** Every spec column the sheet carries: bike keys, then EV keys not already present. */
export function specSheetKeys(): string[] {
  return [...BIKE_SPEC_KEYS, ...EV_SPEC_KEYS.filter((k) => !(BIKE_SPEC_KEYS as readonly string[]).includes(k))];
}

export function specSheetHeader(): string[] {
  return [...SPEC_SHEET_ID_COLUMNS, ...SPEC_SHEET_SHEET_ONLY, ...specSheetKeys()];
}

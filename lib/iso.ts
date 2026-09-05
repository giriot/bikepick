/**
 * Portable date-window helpers.
 * ---------------------------------------------------------------------------
 * This schema stores every timestamp as TEXT ISO-8601 UTC
 * ('2026-09-05T06:51:52.123Z') and every calendar date as TEXT 'YYYY-MM-DD'.
 * Both forms sort lexicographically in exactly the same order they sort
 * chronologically, so comparing them against a 'YYYY-MM-DD' string cutoff is
 * correct on *both* drivers (SQLite in dev, Postgres/Supabase in production).
 *
 * Why this exists: application SQL used SQLite's `date('now', '-30 days')`
 * modifier syntax. Postgres has no such function, so every query built that way
 * failed in production with
 *     ERROR 42883: function date(unknown, unknown) does not exist
 * Computing the boundary in JavaScript keeps the emitted SQL plain and portable.
 *
 * Rules for callers:
 *   - prefer passing these helpers as bound `?` parameters
 *   - `>= isoDaysAgo(n)` -> rows from the start of that UTC day onwards
 *   - `<  isoToday()`    -> rows strictly before the current UTC day
 */

const DAY_MS = 86_400_000;

/** Largest window we will compute (10 years). Guards against `?range=1e300`. */
const MAX_DAYS = 3650;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Signed, magnitude-capped day count. NaN -> 0; ±Infinity -> ±MAX_DAYS (never "no filter"). */
function clampDays(days: number): number {
  const n = Number(days);
  if (Number.isNaN(n)) return 0;
  return Math.max(-MAX_DAYS, Math.min(MAX_DAYS, Math.trunc(n)));
}

/** 'YYYY-MM-DD' for today offset by `days` (may be negative); never throws. */
function shift(days: number): string {
  return new Date(Date.now() + clampDays(days) * DAY_MS).toISOString().slice(0, 10);
}

/** Today, as 'YYYY-MM-DD' (UTC). */
export function isoToday(): string {
  return shift(0);
}

/** The UTC calendar date `days` before today, as 'YYYY-MM-DD'. */
export function isoDaysAgo(days: number): string {
  return shift(-Math.abs(clampDays(days)));
}

/** The UTC calendar date `days` after today, as 'YYYY-MM-DD'. */
export function isoDaysAhead(days: number): string {
  return shift(Math.abs(clampDays(days)));
}

/** First day of the current UTC month, as 'YYYY-MM-DD'. */
export function isoMonthStart(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * A *quoted* SQL date literal for the UTC calendar date `daysAgo` before today,
 * e.g. `'2026-08-06'`. Only for call sites that assemble a query fragment by
 * string building and cannot thread a bound parameter through — the value is
 * derived from `Date#toISOString` and re-checked here, so it is digits and
 * dashes only and cannot carry injected SQL. Prefer `isoDaysAgo()` as a `?`
 * parameter wherever you can.
 */
export function sqlDateLiteral(daysAgo: number): string {
  return quote(isoDaysAgo(daysAgo));
}

/** A *quoted* SQL date literal for today (UTC). Same safety note as above. */
export function sqlTodayLiteral(): string {
  return quote(isoToday());
}

function quote(value: string): string {
  if (!DATE_RE.test(value)) throw new Error(`refusing to inline non-date value: ${value}`);
  return `'${value}'`;
}

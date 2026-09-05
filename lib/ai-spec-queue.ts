/**
 * AI specification-fill queue.
 * ---------------------------------------------------------------------------
 * Drives `generateBikeTemplate()` over many models without losing work when
 * the AI provider refuses to answer. That matters because the Gemini keys on
 * this project are on a free tier that returns 429 for hours at a time, and an
 * in-request loop would simply drop every model after the first refusal.
 *
 * So every model gets a row in `ai_spec_jobs` and the queue is *resumable*:
 *
 *   queued -> running -> applied
 *                    \-> deferred   (quota exceeded: retry after a backoff)
 *                    \-> failed     (kept failing after max_attempts)
 *
 * A quota error is NOT counted as a real failure — the row keeps its attempt
 * budget for genuine problems and is rescheduled with exponential backoff, so a
 * later invocation (the daily cron tick, or someone opening this page) picks it
 * up once the quota window has reset.
 *
 * Safety rules, matching the project's standing policy:
 *   - AI values only ever fill fields that are currently NULL. Curated data is
 *     never overwritten, so a bad model answer cannot destroy a checked figure.
 *   - every applied value is recorded (which keys, what was there before) and
 *     audited, so a batch is reversible and attributable.
 *   - the draft is still labelled AI-derived and unverified; the admin page
 *     shows that so nobody mistakes it for OEM-checked data.
 */
import 'server-only';
import { db, insert, nowIso, uid } from './db';
import { generateBikeTemplate } from './ai-template';
import {
  BIKE_SPEC_KEYS, EV_SPEC_KEYS, NUMERIC_BIKE, BOOL_BIKE, NUMERIC_EV, BOOL_EV,
} from './spec-fields';

/** Anything matching this is a rate/quota refusal, not a real error. */
const QUOTA_ERROR = /429|quota|exhausted|rate.?limit|RESOURCE_EXHAUSTED|credits|too many requests/i;

/** Default work per invocation, in ms. Keeps a batch inside the function limit. */
const DEFAULT_BUDGET_MS = 50_000;
const DEFAULT_MAX_JOBS = 3;
const MAX_BACKOFF_MINUTES = 720; // 12h — a free tier can stay throttled all day

/** A 'running' claim older than this is treated as abandoned and re-queued. */
const STALE_CLAIM_MS = 10 * 60_000;

/**
 * Columns the queue will NOT auto-write. These are the figures a model can only
 * guess at — service schedules, running costs, warranty wording, dealer
 * accessories, colour ranges — and every one of them is a real, visible claim on
 * a public page. Under the project's rule (never fabricate specs) they are
 * captured as *suggestions* on the job for a human to check and paste in, while
 * objectively verifiable equipment and dimensions are applied normally.
 */
export const SPEC_WRITE_DENY = new Set([
  'est_service_cost', 'service_interval_km', 'accessories', 'colours', 'warranty',
  'battery_warranty', 'est_battery_replacement_cost', 'running_cost_per_km',
]);

export type JobStatus = 'queued' | 'running' | 'applied' | 'deferred' | 'failed' | 'skipped';

interface SpecTarget {
  table: 'bike_specs' | 'ev_specs';
  keys: readonly string[];
  numeric: Set<string>;
  bools: Set<string>;
}

function targetFor(fuelType?: string | null): SpecTarget {
  return fuelType === 'electric'
    ? { table: 'ev_specs', keys: EV_SPEC_KEYS, numeric: NUMERIC_EV, bools: BOOL_EV }
    : { table: 'bike_specs', keys: BIKE_SPEC_KEYS, numeric: NUMERIC_BIKE, bools: BOOL_BIKE };
}

function minutesFromNow(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}

/** Exponential: 10m, 20m, 40m, 80m, 160m, 320m, 640m, 720m… */
export function backoffMinutes(attempts: number): number {
  return Math.min(10 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MINUTES);
}

/** Coerce one AI value into the column type. Unknown/blank stays null. */
function coerce(value: unknown, key: string, t: SpecTarget): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (t.bools.has(key)) {
    if (typeof value === 'boolean') return value ? 1 : 0;
    const s = String(value).trim().toLowerCase();
    if (/^(yes|y|true|1|available|yes \(std\))/.test(s)) return 1;
    if (/^(no|n|false|0|not available|absent)$/.test(s)) return 0;
    return null;
  }
  if (t.numeric.has(key)) {
    const n = Number(String(value).replace(/[^\d.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  // A text column must not receive a boolean: `true` rendered on a spec sheet
  // reads as a fact, not a flag. Drop it (the value belongs in a bool column).
  if (typeof value === 'boolean') return null;
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v).trim()).filter(Boolean).slice(0, 12);
    return parts.length ? parts.join(', ').slice(0, 500) : null;
  }
  const s = String(value).trim();
  if (!s || /^(n\/a|na|not recorded|not available|unknown|—|-|true|false|null|none|yes)$/.test(s.toLowerCase())) return null;
  return s.slice(0, 500);
}

/**
 * Per-table SQL that yields (product_id, missing_count) for every non-deleted
 * product in ONE pass. Counting the holes column-by-column per product was an
 * N+1 that took ~38s over 166 models and risked the request limit, so the work
 * moved into SQL. `filled` is a sum of CASE terms over the whitelisted columns —
 * identifiers come from our own SPEC_KEYS arrays, never from user input.
 */
function missingCountSql(table: string, keys: readonly string[]): string {
  const filled = keys.map((k) => `(CASE WHEN s.${k} IS NOT NULL THEN 1 ELSE 0 END)`).join(' + ');
  return `SELECT p.id, p.fuel_type,
                 CASE WHEN s.product_id IS NULL THEN ${keys.length}
                      ELSE ${keys.length} - (${filled}) END AS missing
            FROM products p
            LEFT JOIN ${table} s ON s.product_id = p.id AND s.variant_id IS NULL
           WHERE p.deleted_at IS NULL`;
}

/** The still-empty whitelisted columns for one product (used by single-model paths). */
async function missingFields(productId: string, fuelType: string | null): Promise<string[]> {
  const t = targetFor(fuelType);
  const row = await db.get<any>(
    `SELECT * FROM ${t.table} WHERE product_id = ? AND variant_id IS NULL`, [productId],
  );
  return t.keys.filter((k) => row?.[k] === null || row?.[k] === undefined);
}

/** Multi-row INSERT with ? placeholders — supported by SQLite and Postgres alike. */
async function insertJobs(rows: Record<string, string | number | null>[]): Promise<number> {
  if (!rows.length) return 0;
  const cols = ['id', 'product_id', 'status', 'attempts', 'max_attempts', 'next_run_at',
                'missing_before', 'requested_by', 'created_at', 'updated_at'];
  const CHUNK = 40;
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const values = chunk.map(() => `(${cols.map(() => '?').join(', ')})`).join(', ');
    const params = chunk.flatMap((r) => cols.map((c) => r[c] as string | number | null));
    await db.run(`INSERT INTO ai_spec_jobs (${cols.join(', ')}) VALUES ${values}`, params);
    n += chunk.length;
  }
  return n;
}

export interface EnqueueResult {
  created: number; reset: number; already_queued: number; complete: number; considered: number;
}

/**
 * Queue every model whose spec sheet still has holes.
 * Idempotent: an existing non-terminal job for the same product is left alone,
 * a finished one (applied/failed/skipped) is reset so a new pass can run.
 */
export async function enqueueModels(opts: {
  statuses?: string[];
  limit?: number;
  skipComplete?: boolean;
  userId?: string | null;
} = {}): Promise<EnqueueResult> {
  const statuses = opts.statuses?.length ? opts.statuses : ['published'];
  const limit = Math.max(1, Math.min(Number(opts.limit) || 500, 1000));
  const skipComplete = opts.skipComplete !== false;
  const res: EnqueueResult = { created: 0, reset: 0, already_queued: 0, complete: 0, considered: 0 };

  const placeholders = statuses.map(() => '?').join(',');
  const statusSql = `p.status IN (${placeholders})`;
  const params = [...statuses];

  // One pass per spec table; each row is (product_id, fuel_type, missing).
  const [bikeRows, evRows] = await Promise.all([
    db.all<any>(`${missingCountSql('bike_specs', BIKE_SPEC_KEYS)} AND ${statusSql} AND (p.fuel_type IS NULL OR p.fuel_type <> 'electric')
                  ORDER BY p.brand_id, p.name LIMIT ${Math.trunc(limit)}`, params),
    db.all<any>(`${missingCountSql('ev_specs', EV_SPEC_KEYS)} AND ${statusSql} AND p.fuel_type = 'electric'
                  ORDER BY p.brand_id, p.name LIMIT ${Math.trunc(limit)}`, params),
  ]);

  const candidates = [...bikeRows, ...evRows]
    // A row whose id is missing would enqueue a job that can never resolve to a
    // product, and a NULL product_id is a NOT NULL violation on Postgres/SQLite.
    .filter((c) => typeof c.id === 'string' && c.id)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .slice(0, limit);
  res.considered = candidates.length;
  if (!candidates.length) return res;

  const jobs = await db.all<any>(`SELECT id, product_id, status, missing_before FROM ai_spec_jobs`);
  const byProduct = new Map(jobs.map((j) => [j.product_id, j]));

  const toInsert: Record<string, string | number | null>[] = [];
  const now = nowIso();
  const resets: string[] = [];

  for (const c of candidates) {
    const missing = Number(c.missing || 0);
    const existing = byProduct.get(c.id);

    if (existing) {
      if (['applied', 'failed', 'skipped'].includes(existing.status)) {
        if (!missing && skipComplete) { res.complete++; continue; }
        resets.push(existing.id);
      } else {
        res.already_queued++;
      }
      continue;
    }
    if (!missing && skipComplete) { res.complete++; continue; }
    toInsert.push({
      id: uid('asj'), product_id: c.id, status: 'queued', attempts: 0, max_attempts: 8,
      next_run_at: now, missing_before: missing, requested_by: opts.userId ?? null,
      created_at: now, updated_at: now,
    });
  }

  res.created = await insertJobs(toInsert);

  if (resets.length) {
    const ph = resets.map(() => '?').join(',');
    await db.run(
      `UPDATE ai_spec_jobs SET status = 'queued', attempts = 0, next_run_at = ?, last_error = NULL,
              finished_at = NULL, claim_token = NULL, updated_at = ? WHERE id IN (${ph})`,
      [now, now, ...resets],
    );
    res.reset = resets.length;
  }
  return res;
}

export interface BatchResult {
  ran: number; applied: number; deferred: number; failed: number; skipped: number;
  quotaLimited: boolean; stoppedBy: 'budget' | 'empty' | 'max_jobs'; remaining: number;
  details: { product: string; outcome: string; fields: number; note?: string }[];
}

/**
 * Process jobs that are due, for at most `budgetMs`. Call it from the admin
 * page (a button) or from the cron route; both share the same claim logic, so
 * two callers cannot apply the same model twice.
 */
export async function runQueue(opts: {
  budgetMs?: number; maxJobs?: number; userId?: string | null;
} = {}): Promise<BatchResult> {
  const budgetMs = Math.max(3_000, Math.min(Number(opts.budgetMs) || DEFAULT_BUDGET_MS, 120_000));
  const maxJobs = Math.max(1, Math.min(Number(opts.maxJobs) || DEFAULT_MAX_JOBS, 12));
  const started = Date.now();
  const out: BatchResult = {
    ran: 0, applied: 0, deferred: 0, failed: 0, skipped: 0,
    quotaLimited: false, stoppedBy: 'empty', remaining: 0, details: [],
  };

  // A batch killed mid-flight (function limit, redeploy) would otherwise leave
  // rows pinned in 'running' forever, so a claim older than STALE_CLAIM_MS is
  // handed back to the queue.
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const due = await db.all<any>(
    `SELECT j.*, p.name AS product_name, p.fuel_type, p.status AS product_status,
            b.name AS brand_name
       FROM ai_spec_jobs j
       JOIN products p ON p.id = j.product_id
       JOIN brands b ON b.id = p.brand_id
      WHERE j.next_run_at <= ?
        AND (   j.status IN ('queued', 'deferred')
             OR (j.status = 'running' AND COALESCE(j.started_at, j.updated_at) < ?) )
      ORDER BY j.attempts, j.created_at
      LIMIT ${Math.trunc(maxJobs * 3)}`,
    [nowIso(), staleBefore],
  );

  for (const job of due) {
    if (out.ran >= maxJobs) { out.stoppedBy = 'max_jobs'; break; }
    if (Date.now() - started > budgetMs) { out.stoppedBy = 'budget'; break; }

    // Claim: only one caller can move the row into 'running' with our token.
    const token = uid('claim');
    await db.run(
      `UPDATE ai_spec_jobs SET status = 'running', claim_token = ?, started_at = ?,
              attempts = attempts + 1, updated_at = ?
        WHERE id = ? AND next_run_at <= ?
        AND (   status IN ('queued', 'deferred')
             OR (status = 'running' AND COALESCE(started_at, updated_at) < ?))`,
      [token, nowIso(), nowIso(), job.id, nowIso(), staleBefore],
    );
    const owned = await db.get<any>(`SELECT claim_token FROM ai_spec_jobs WHERE id = ?`, [job.id]);
    if (owned?.claim_token !== token) continue; // lost the race, another caller has it

    out.ran++;
    const label = `${job.brand_name} ${job.product_name}`;
    try {
      const draft = await generateBikeTemplate(job.brand_name, job.product_name, job.fuel_type);
      const applied = await applySpecs(job.product_id, job.fuel_type, draft.specs);

      if (!applied.filled.length) {
        // AI answered but offered nothing we are allowed to auto-write; any
        // held-back values are still stored so they are not lost.
        await db.run(
          `UPDATE ai_spec_jobs SET status = 'skipped', claim_token = NULL, finished_at = ?,
                  last_error = NULL, suggested_keys = ?, updated_at = ? WHERE id = ?`,
          [nowIso(), JSON.stringify(applied.suggested), nowIso(), job.id],
        );
        out.skipped++;
        out.details.push({
          product: label, outcome: 'skipped', fields: 0,
          note: Object.keys(applied.suggested).length
            ? `${Object.keys(applied.suggested).length} suggestion(s) held for review`
            : 'no new values offered',
        });
        continue;
      }

      await db.run(
        `UPDATE ai_spec_jobs SET status = 'applied', claim_token = NULL, finished_at = ?,
                provider = ?, fields_filled = ?, filled_keys = ?, previous_values = ?,
                suggested_keys = ?, last_error = NULL, updated_at = ? WHERE id = ?`,
        [
          nowIso(), draft.provider ?? null, applied.filled.length,
          JSON.stringify(applied.filled), JSON.stringify(applied.previous),
          JSON.stringify(applied.suggested), nowIso(), job.id,
        ],
      );
      // Keep the model's updated_at in step so sitemap lastMod and the admin
      // "last touched" column reflect the change.
      await db.run('UPDATE products SET updated_at = ? WHERE id = ?', [nowIso(), job.product_id]);

      out.applied++;
      out.details.push({ product: label, outcome: 'applied', fields: applied.filled.length, note: draft.warnings?.length ? `${draft.warnings.length} warning(s)` : undefined });
      await logApply(opts.userId ?? null, job, label, applied);
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 900);
      const quota = QUOTA_ERROR.test(message);
      const attempts = Number(job.attempts || 0) + 1;
      const exhausted = attempts >= Number(job.max_attempts || 8);
      const status: JobStatus = quota && !exhausted ? 'deferred' : 'failed';
      const wait = quota ? backoffMinutes(attempts) : backoffMinutes(attempts);

      await db.run(
        `UPDATE ai_spec_jobs SET status = ?, claim_token = NULL, next_run_at = ?,
                last_error = ?, updated_at = ? WHERE id = ?`,
        [status, minutesFromNow(wait), message, nowIso(), job.id],
      );
      if (quota) { out.quotaLimited = true; out.deferred++; } else { out.failed++; }
      out.details.push({
        product: label, outcome: status, fields: 0,
        note: `${quota ? 'AI quota exceeded — retrying in ' + wait + 'm' : message}${exhausted ? ' (giving up)' : ''}`,
      });
    }
  }

  out.remaining = await countDue();
  if (out.ran === 0) out.stoppedBy = 'empty';
  else if (out.stoppedBy === 'empty') out.stoppedBy = out.remaining > 0 ? 'budget' : 'empty';
  return out;
}

/** Write AI values into the spec row, but only where it is currently empty. */
async function applySpecs(
  productId: string, fuelType: string | null, specs: Record<string, any>,
): Promise<{ filled: string[]; previous: Record<string, unknown>; suggested: Record<string, unknown> }> {
  const t = targetFor(fuelType);
  const row = await db.get<any>(
    `SELECT * FROM ${t.table} WHERE product_id = ? AND variant_id IS NULL`, [productId],
  );

  const toSet: Record<string, string | number> = {};
  const previous: Record<string, unknown> = {};
  const suggested: Record<string, unknown> = {};
  for (const key of t.keys) {
    const current = row?.[key];
    if (current !== null && current !== undefined) continue; // never overwrite curated data
    const value = coerce(specs?.[key], key, t);
    if (value === null) continue;
    // Held back for human review rather than published on the AI's say-so.
    if (SPEC_WRITE_DENY.has(key)) { suggested[key] = value; continue; }
    toSet[key] = value;
    previous[key] = null;
  }
  if (!Object.keys(toSet).length) return { filled: [], previous, suggested };

  const keys = Object.keys(toSet);
  if (!row) {
    await insert(t.table, { id: uid('spc'), product_id: productId, variant_id: null, ...toSet });
  } else {
    await db.run(
      `UPDATE ${t.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      [...keys.map((k) => toSet[k]), nowIso(), row.id],
    );
  }
  return { filled: keys, previous, suggested };
}

/**
 * Undo one applied job: every key the job filled is returned to the value it
 * had before (always NULL, since we only ever write into empty fields). Lets a
 * bad AI batch be rolled back without hand-written SQL.
 */
export async function revertJob(jobId: string): Promise<{ product_id: string | null; reverted: number }> {
  const job = await db.get<any>(
    `SELECT id, product_id, status, filled_keys FROM ai_spec_jobs WHERE id = ?`, [jobId],
  );
  if (!job) return { product_id: null, reverted: 0 };
  const rawKeys: unknown = (() => {
    try { const parsed = JSON.parse(job.filled_keys || '[]'); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  })();
  const keys: string[] = (rawKeys as unknown[]).filter((k): k is string => typeof k === 'string');
  if (!keys.length) return { product_id: job.product_id, reverted: 0 };

  const product = await db.get<any>(`SELECT id, fuel_type FROM products WHERE id = ?`, [job.product_id]);
  const t = targetFor(product?.fuel_type);
  // Defensive: only null columns that really belong to this spec table.
  const safe = keys.filter((k) => (t.keys as readonly string[]).includes(k));
  const row = await db.get<any>(
    `SELECT id FROM ${t.table} WHERE product_id = ? AND variant_id IS NULL`, [job.product_id],
  );
  if (row && safe.length) {
    await db.run(
      `UPDATE ${t.table} SET ${safe.map((k) => `${k} = NULL`).join(', ')}, updated_at = ? WHERE id = ?`,
      [nowIso(), row.id],
    );
  }
  await db.run(
    `UPDATE ai_spec_jobs SET status = 'queued', fields_filled = 0, filled_keys = NULL,
            previous_values = NULL, attempts = 0, next_run_at = ?, last_error = 'reverted by admin',
            finished_at = NULL, updated_at = ? WHERE id = ?`,
    [minutesFromNow(60), nowIso(), jobId],
  );
  return { product_id: job.product_id, reverted: safe.length };
}

async function logApply(userId: string | null, job: any, label: string, applied: { filled: string[] }) {
  // Audit best-effort: a logging failure must never abort a spec update.
  try {
    await insert('audit_logs', {
      id: uid('aud'),
      actor_id: userId, actor_email: null, actor_role: userId ? null : 'system',
      action: 'ai_spec.fill', entity_type: 'product', entity_id: job.product_id,
      detail: JSON.stringify({ model: label, fields: applied.filled, source: 'ai_template_queue' }).slice(0, 4000),
      ip: null,
    });
  } catch { /* ignore */ }
}

async function countDue(): Promise<number> {
  const r = await db.get<any>(
    `SELECT COUNT(*) AS c FROM ai_spec_jobs WHERE status IN ('queued','deferred') AND next_run_at <= ?`,
    [nowIso()],
  );
  return Number(r?.c ?? 0);
}

export interface QueueSummary {
  queued: number; deferred: number; running: number; applied: number; failed: number; skipped: number;
  dueNow: number; fieldsFilled: number; nextRetryAt: string | null; lastError: string | null;
}

export async function queueSummary(): Promise<QueueSummary> {
  const rows = await db.all<any>(`SELECT status, COUNT(*) AS c, COALESCE(SUM(fields_filled),0) AS f FROM ai_spec_jobs GROUP BY status`);
  const by = new Map(rows.map((r) => [r.status, r]));
  const next = await db.get<any>(
    `SELECT next_run_at, last_error FROM ai_spec_jobs
      WHERE status IN ('queued','deferred') ORDER BY next_run_at LIMIT 1`,
  );
  const get = (s: JobStatus) => Number(by.get(s)?.c ?? 0);
  return {
    queued: get('queued'), deferred: get('deferred'), running: get('running'),
    applied: get('applied'), failed: get('failed'), skipped: get('skipped'),
    dueNow: await countDue(),
    fieldsFilled: Number(by.get('applied')?.f ?? 0),
    nextRetryAt: next?.next_run_at ?? null,
    lastError: next?.last_error ?? null,
  };
}

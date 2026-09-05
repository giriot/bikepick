import { NextRequest } from 'next/server';
import { db, nowIso } from '@/lib/db';
import { requirePermission } from '@/lib/rbac';
import { handleError, ok, fail, readJson } from '@/lib/api';
import { audit } from '@/lib/audit';
import { enqueueModels, queueSummary, revertJob, runQueue } from '@/lib/ai-spec-queue';

export const dynamic = 'force-dynamic';

/** Queue state + the jobs themselves, newest activity first. */
export async function GET() {
  try {
    await requirePermission('product.write');
    const [summary, jobs] = await Promise.all([
      queueSummary(),
      db.all<any>(
        `SELECT j.id, j.status, j.attempts, j.max_attempts, j.next_run_at, j.last_error,
                j.provider, j.missing_before, j.fields_filled, j.filled_keys, j.suggested_keys, j.started_at,
                j.finished_at, j.updated_at,
                p.name AS product_name, p.slug AS product_slug, p.status AS product_status,
                p.fuel_type, b.name AS brand_name
           FROM ai_spec_jobs j
           JOIN products p ON p.id = j.product_id
           JOIN brands b ON b.id = p.brand_id
          ORDER BY (j.status IN ('running','queued','deferred')) DESC, j.updated_at DESC
          LIMIT 300`,
      ),
    ]);
    return ok({ summary, jobs });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('product.write');
    const body = await readJson<any>(req);
    const action = String(body?.action || '');

    if (action === 'enqueue') {
      const statuses = Array.isArray(body.statuses) && body.statuses.length
        ? body.statuses.filter((s: string) => ['published', 'draft'].includes(s))
        : ['published'];
      const res = await enqueueModels({
        statuses,
        limit: Number(body.limit) || 200,
        skipComplete: body.skipComplete !== false,
        userId: user.id,
      });
      await audit(user, 'ai_spec.enqueue', 'ai_spec_jobs', undefined, { ...res, statuses });
      return ok(res, `Queued ${res.created} model(s), reset ${res.reset}`);
    }

    if (action === 'run') {
      const res = await runQueue({
        budgetMs: Number(body.budgetMs) || undefined,
        maxJobs: Number(body.maxJobs) || undefined,
        userId: user.id,
      });
      await audit(user, 'ai_spec.run', 'ai_spec_jobs', undefined, {
        ran: res.ran, applied: res.applied, deferred: res.deferred, failed: res.failed,
      });
      return ok(res, describeRun(res));
    }

    if (action === 'retry-now') {
      // Force every deferred/failed job due immediately (after you add a key).
      const ids = String(body.ids || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)
        .slice(0, 300);
      if (ids.length) {
        const ph = ids.map(() => '?').join(',');
        await db.run(
          `UPDATE ai_spec_jobs SET status = 'queued', next_run_at = ?, attempts = 0,
                  claim_token = NULL, updated_at = ? WHERE id IN (${ph})`,
          [nowIso(), nowIso(), ...ids],
        );
      } else {
        await db.run(
          `UPDATE ai_spec_jobs SET status = 'queued', next_run_at = ?, attempts = 0,
                  claim_token = NULL, updated_at = ?
            WHERE status IN ('deferred','failed')`,
          [nowIso(), nowIso()],
        );
      }
      await audit(user, 'ai_spec.retry_now', 'ai_spec_jobs', undefined, { ids: ids.length });
      return ok({ forced: ids.length || 'all' }, 'Jobs are due again');
    }

    if (action === 'revert') {
      const ids = String(body.ids || '').split(',').map((s: string) => s.trim()).filter(Boolean).slice(0, 200);
      if (!ids.length) return fail('Nothing selected to revert', 422);
      let reverted = 0;
      for (const id of ids) reverted += (await revertJob(id)).reverted;
      await audit(user, 'ai_spec.revert', 'ai_spec_jobs', ids.join(','), { reverted });
      return ok({ jobs: ids.length, reverted }, `Reverted ${reverted} field(s) back to empty`);
    }

    if (action === 'clear-finished') {
      await db.run(`DELETE FROM ai_spec_jobs WHERE status IN ('applied','skipped','failed')`);
      await audit(user, 'ai_spec.clear_finished', 'ai_spec_jobs', undefined);
      return ok({}, 'Finished jobs removed');
    }

    return fail('Unknown action', 422);
  } catch (e) {
    return handleError(e);
  }
}

function describeRun(r: { ran: number; applied: number; deferred: number; failed: number; quotaLimited: boolean; remaining: number }): string {
  if (!r.ran) return 'Nothing was due to run.';
  const parts = [`processed ${r.ran}`, `${r.applied} updated`];
  if (r.deferred) parts.push(`${r.deferred} waiting on AI quota (will retry automatically)`);
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.remaining) parts.push(`${r.remaining} still due`);
  return parts.join(' · ');
}

import { NextRequest } from 'next/server';
import { authorizeCron } from '@/lib/cron';
import { ok, fail, handleError } from '@/lib/api';
import { queueSummary, runQueue } from '@/lib/ai-spec-queue';

export const dynamic = 'force-dynamic';

/**
 * Advances the AI specification-fill queue.
 *
 *   GET                        one batch (3 models, 50s budget)
 *   ?enqueue=1                 re-scan the catalogue for spec gaps first, then run
 *   ?enqueue=1&statuses=draft  restrict the scan to given product statuses
 *   ?maxJobs=6&budgetMs=45000  tune the batch (budgetMs is capped at 120s)
 *
 * Deliberately NOT scheduled in vercel.json. This project is on Vercel Hobby,
 * which caps cron at 2 jobs and rejects any schedule more frequent than once a
 * day, so a 20-minute entry here would fail the whole deployment; and a daily
 * tick cannot honour a 10-20 minute quota backoff anyway. Drive it from the
 * admin queue page, or add the crons entry to vercel.json once the project is
 * on Pro (schedule field: every 20 minutes).
 *
 * Safe to call as often as you like: jobs are claimed by token so two callers
 * cannot apply the same model twice, quota refusals are rescheduled rather than
 * dropped, and only empty spec fields are ever written.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = authorizeCron(req);
    if (!auth.ok) return fail(auth.error, auth.status);

    const sp = req.nextUrl.searchParams;
    if (sp.get('enqueue')) {
      const { enqueueModels } = await import('@/lib/ai-spec-queue');
      const statuses = (sp.get('statuses') || 'published').split(',').map((s) => s.trim()).filter(Boolean);
      await enqueueModels({ statuses, limit: Number(sp.get('limit')) || 200 });
    }

    const result = await runQueue({
      maxJobs: Number(sp.get('maxJobs')) || 3,
      budgetMs: Number(sp.get('budgetMs')) || 50_000,
    });
    const summary = await queueSummary();
    return ok(
      { ...result, summary },
      `ran ${result.ran} · applied ${result.applied} · deferred ${result.deferred} · failed ${result.failed}` +
        (result.quotaLimited ? ' · AI quota limited' : ''),
    );
  } catch (e) {
    return handleError(e);
  }
}

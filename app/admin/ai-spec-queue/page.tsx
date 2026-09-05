import { requirePermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { queueSummary, type QueueSummary } from '@/lib/ai-spec-queue';
import { AdminHeader, AdminCard } from '@/components/admin/ui';
import { AiSpecQueuePanel } from '@/components/admin/AiSpecQueuePanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI spec queue · Bikepick Admin', robots: { index: false, follow: false } };

/**
 * Completes model specification sheets from the AI template, as a durable queue
 * so a provider quota refusal defers the work instead of losing it.
 */
export default async function AiSpecQueuePage() {
  await requirePermission('product.write');

  const EMPTY: QueueSummary = {
    queued: 0, deferred: 0, running: 0, applied: 0, failed: 0, skipped: 0,
    dueNow: 0, fieldsFilled: 0, nextRetryAt: null, lastError: null,
  };
  // Read failures are shown here rather than thrown: this page is the operator's
  // only window into a queue that may be mid-retry, and a blank error screen tells
  // them nothing about why (e.g. the ai_spec_jobs migration not applied yet).
  let loadError: string | null = null;
  let summary = EMPTY;
  let jobs: any[] = [];
  try {
    [summary, jobs] = await Promise.all([
      queueSummary(),
      db.all<any>(
        `SELECT j.id, j.status, j.attempts, j.max_attempts, j.next_run_at, j.last_error,
                j.provider, j.missing_before, j.fields_filled, j.filled_keys, j.suggested_keys,
                p.name AS product_name, p.status AS product_status, p.fuel_type, b.name AS brand_name
           FROM ai_spec_jobs j
           JOIN products p ON p.id = j.product_id
           JOIN brands b ON b.id = p.brand_id
          ORDER BY (j.status IN ('running','queued','deferred')) DESC, j.updated_at DESC
          LIMIT 300`,
      ),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="space-y-4">
      <AdminHeader
        title="AI specification queue"
        subtitle="Fills empty spec-sheet fields from the AI template. Quota-limited models are marked and retried on the next run."
      />
      {loadError && (
        <p className="rounded-lg border border-warn bg-warn-soft px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          Could not load the queue: <span className="font-medium">{loadError}</span>
          <br />If this mentions <code>ai_spec_jobs</code>, apply{' '}
          <code>database/migrations/005_ai_spec_jobs.sql</code> in the Supabase SQL editor.
        </p>
      )}
      <AdminCard>
        <AiSpecQueuePanel initialSummary={summary} initialJobs={jobs} />
      </AdminCard>
    </div>
  );
}

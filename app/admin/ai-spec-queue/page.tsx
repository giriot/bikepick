import { requirePermission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { queueSummary } from '@/lib/ai-spec-queue';
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
  const [summary, jobs] = await Promise.all([
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

  return (
    <div className="space-y-4">
      <AdminHeader
        title="AI specification queue"
        subtitle="Fills empty spec-sheet fields from the AI template. Quota-limited models are marked and retried on the next run."
      />
      <AdminCard>
        <AiSpecQueuePanel initialSummary={summary} initialJobs={jobs} />
      </AdminCard>
    </div>
  );
}

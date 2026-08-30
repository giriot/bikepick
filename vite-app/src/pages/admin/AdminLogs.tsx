import React, { useCallback, useEffect, useState } from 'react';
import { getAdminLogs } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { AdminLog } from '../../lib/types';
import { EmptyState, ErrorBlock, LoadingBlock } from '../../components/ui';

/**
 * /admin/logs — read-only audit trail of admin actions.
 * Every admin write is captured automatically by a DB trigger.
 */
export default function AdminLogs() {
  const [rows, setRows] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows((await getAdminLogs({ page: 1 })) as AdminLog[]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-black text-ink-900">Audit Log</h1>
      <p className="mb-5 text-sm text-ink-500">Last {rows.length} admin actions, newest first. Entries can never be edited or deleted from the UI.</p>
      {rows.length ? (
        <div className="card divide-y divide-ink-100 text-sm">
          {rows.map((l) => (
            <div key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-2.5">
              <div className="min-w-[200px] flex-1">
                <p className="font-bold text-ink-800">
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">{l.action}</span>{' '}
                  <span className="text-ink-700">{l.record_type}</span>
                  {l.record_id && <code className="ml-1 rounded bg-ink-50 px-1 text-[11px] text-ink-400">{l.record_id.slice(0, 8)}…</code>}
                </p>
                {l.previous_data || l.new_data || l.meta ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-bold text-primary-600 hover:underline">view before / after</summary>
                    <div className="mt-1 grid gap-2 md:grid-cols-2">
                      {l.previous_data && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-ink-900 p-3 text-[11px] leading-relaxed text-red-200">{JSON.stringify(l.previous_data, null, 2)}</pre>
                      )}
                      {l.new_data && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-ink-900 p-3 text-[11px] leading-relaxed text-emerald-200">{JSON.stringify(l.new_data, null, 2)}</pre>
                      )}
                      {l.meta && (
                        <pre className="max-h-64 overflow-auto rounded-lg bg-ink-900 p-3 text-[11px] leading-relaxed text-ink-100 md:col-span-2">{JSON.stringify(l.meta, null, 2)}</pre>
                      )}
                    </div>
                  </details>
                ) : null}
              </div>
              <div className="text-xs text-ink-400">
                <span className="font-bold text-ink-600">{l.admin_email || l.admin_id?.slice(0, 8) || 'admin'}</span> · {timeAgo(l.created_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No audit entries yet" desc="Admin changes (bike edits, approvals, settings, etc.) are logged here automatically." />
      )}
    </div>
  );
}

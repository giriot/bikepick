import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { queryReports, setReportStatus } from '../../lib/api';
import type { Report, ReportStatus } from '../../lib/types';
import { titleCase, timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, Tabs } from '../../components/ui';

/**
 * /admin/reports — abuse/false-info reports triage.
 */
export default function AdminReports() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportStatus | 'all'>('open');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryReports({ status: tab === 'all' ? undefined : tab });
      setRows(res.rows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (rp: Report, status: ReportStatus) => {
    setBusyId(rp.id);
    try {
      await setReportStatus(rp.id, status, null);
      toast(status === 'resolved' ? 'Marked as resolved.' : 'Re-opened.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Reports</h1>
      <Tabs
        tabs={[
          { id: 'open', label: 'Open' },
          { id: 'resolved', label: 'Resolved' },
          { id: 'dismissed', label: 'Dismissed' },
          { id: 'all', label: 'All' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-xl"
      />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((rp) => (
            <Card key={rp.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">{titleCase(rp.item_type)}</span>
                    {rp.item_id && <code className="rounded bg-ink-100 px-1.5 py-0.5 text-[11px] text-ink-500">{rp.item_id.slice(0, 8)}…</code>}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${rp.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{rp.status}</span>
                  </div>
                  <p className="mt-2 font-semibold text-ink-800">{rp.reason}</p>
                  {rp.details && <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{rp.details}</p>}
                  <p className="mt-2 text-xs text-ink-400">by {rp.reporter_name || rp.user_id?.slice(0, 8) || 'unknown'} · {timeAgo(rp.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {rp.status === 'open' ? (
                    <>
                      <Button size="sm" variant="success" loading={busyId === rp.id} onClick={() => resolve(rp, 'resolved')}>✓ Resolved</Button>
                      <Button size="sm" variant="outline" loading={busyId === rp.id} onClick={() => resolve(rp, 'dismissed')}>Dismiss</Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" loading={busyId === rp.id} onClick={() => resolve(rp, 'open')}>Re-open</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${tab} reports`} desc="User reports on listings, offers, reviews or content land here." />
      )}
    </div>
  );
}

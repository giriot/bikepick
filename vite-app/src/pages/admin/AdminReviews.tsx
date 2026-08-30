import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { queryReviews, setReviewStatus, deleteReview } from '../../lib/api';
import type { Review, ReviewStatus } from '../../lib/types';
import { timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, LoadingBlock, RatingStars, Tabs } from '../../components/ui';

/**
 * /admin/reviews — review moderation: approve / hide / delete user reviews.
 */
export default function AdminReviews() {
  const { toast } = useApp();
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReviewStatus | 'all'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryReviews({ status: tab === 'all' ? undefined : tab });
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

  const setStatus = async (r: Review, status: ReviewStatus) => {
    setBusyId(r.id);
    try {
      await setReviewStatus(r.id, status);
      toast(status === 'approved' ? 'Review approved — now public.' : 'Review hidden.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: Review) => {
    if (!confirm('Permanently delete this review?')) return;
    setBusyId(r.id);
    try {
      await deleteReview(r.id);
      toast('Review deleted.', 'success');
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
      <h1 className="mb-5 text-2xl font-black text-ink-900">Review Moderation</h1>
      <Tabs
        tabs={[
          { id: 'pending', label: 'Pending' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Hidden' },
          { id: 'all', label: 'All' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-xl"
      />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[220px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink-900">{((r as any).bike_brand_name || '') + ' ' + ((r as any).bike_name || 'Bike')}</p>
                    <RatingStars value={r.rating} />
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : r.status === 'rejected' ? 'bg-ink-100 text-ink-500' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-500">
                    {r.user_name || 'Anonymous'} · {timeAgo(r.created_at)}
                  </p>
                  {r.title && <p className="mt-2 font-semibold text-ink-800">{r.title}</p>}
                  <p className="mt-1 whitespace-pre-line text-sm text-ink-600">{r.comment}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {r.status !== 'approved' && <Button size="sm" variant="success" loading={busyId === r.id} onClick={() => setStatus(r, 'approved')}>Approve</Button>}
                  {r.status !== 'rejected' && <Button size="sm" variant="outline" loading={busyId === r.id} onClick={() => setStatus(r, 'rejected')}>Hide</Button>}
                  <Button size="sm" variant="ghost" className="!text-red-600" loading={busyId === r.id} onClick={() => remove(r)}>Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${tab === 'all' ? '' : tab} reviews`} desc="User reviews appear here for moderation before (or after) publishing." />
      )}
    </div>
  );
}

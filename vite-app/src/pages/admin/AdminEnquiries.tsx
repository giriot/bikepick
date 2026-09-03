import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { queryEnquiries } from '../../lib/api';
import type { Enquiry, EnquiryType } from '../../lib/types';
import { titleCase, timeAgo } from '../../lib/format';
import { Card, EmptyState, ErrorBlock, LoadingBlock, Tabs } from '../../components/ui';

/**
 * /admin/enquiries — read-only view of all enquiries (buyer → seller / dealer / platform).
 */
export default function AdminEnquiries() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<EnquiryType | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryEnquiries({
        type: tab === 'all' ? undefined : tab,
      });
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

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">All Enquiries</h1>
      <Tabs
        tabs={[
          { id: 'all', label: 'All' },
          { id: 'contact_seller', label: 'Contact seller' },
          { id: 'dealer_offer', label: 'Dealer offers' },
          { id: 'callback', label: 'Callback' },
          { id: 'general', label: 'General' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-2xl"
      />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-bold text-ink-600">{titleCase(e.type)}</span>
                <span className="font-bold text-ink-900">{e.bike_label || e.used_bike_label || 'General enquiry'}</span>
                <span className="text-xs text-ink-400">· {timeAgo(e.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-ink-600">{e.message || '—'}</p>
              <p className="mt-2 text-xs text-ink-500">
                {e.from_name || e.from_user_id?.slice(0, 8)}
                {e.from_email && <span className="text-ink-400"> · {e.from_email}</span>}
                {e.from_phone && <span className="text-ink-400"> · {e.from_phone}</span>}
                {e.to_user_id && <span className="text-ink-400"> → {e.to_user_id.slice(0, 8)}…</span>}
                {e.dealer_offer_id && <span className="text-ink-400"> · offer {e.dealer_offer_id.slice(0, 8)}…</span>}
                {e.used_bike_id && <span className="text-ink-400"> · used {e.used_bike_id.slice(0, 8)}…</span>}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No enquiries yet" desc="Enquiries from the public site appear here for awareness." />
      )}
    </div>
  );
}

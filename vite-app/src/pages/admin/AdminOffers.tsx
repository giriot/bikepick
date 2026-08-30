import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { queryOffers, setOfferStatus } from '../../lib/api';
import type { DealerOffer } from '../../lib/types';
import { inr, formatDate, timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, LoadingBlock, Modal, Textarea, Tabs } from '../../components/ui';

/**
 * /admin/offers — approve / reject dealer offers.
 * Every offer requires admin approval before it appears publicly.
 */
export default function AdminOffers() {
  const { toast } = useApp();
  const [rows, setRows] = useState<DealerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'waiting' | 'approved' | 'rejected' | 'all'>('waiting');
  const [view, setView] = useState<DealerOffer | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryOffers({ status: tab === 'all' ? undefined : tab, per_page: 100 });
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

  const decide = async (o: DealerOffer, status: 'approved' | 'rejected') => {
    if (status === 'rejected' && !reason.trim()) {
      toast('A rejection reason is required — the dealer is told why.', 'error');
      return;
    }
    setBusy(true);
    try {
      await setOfferStatus(o.id, status, reason.trim() || null);
      toast(status === 'approved' ? 'Offer approved — now live on the bike page.' : 'Offer rejected.', 'success');
      setView(null);
      setReason('');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Dealer Offers</h1>
      <Tabs
        tabs={[
          { id: 'waiting', label: 'Waiting' },
          { id: 'approved', label: 'Approved' },
          { id: 'rejected', label: 'Rejected' },
          { id: 'all', label: 'All' },
        ]}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-xl"
      />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink-900">{o.brand_name} {o.bike_name}</p>
                  {o.variant_name && <span className="text-xs text-ink-400">· {o.variant_name}</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${o.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : o.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{o.status}</span>
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {o.dealer_name} · {o.dealer_city} · {inr(o.final_offer_price || o.ex_showroom_price)}
                  {o.discount_amount ? ` · save ${inr(o.discount_amount)}` : ''}
                  {o.exchange_bonus ? ` · exchange ${inr(o.exchange_bonus)}` : ''}
                  {' · '}submitted {timeAgo(o.created_at)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setView(o); setReason(''); }}>Review</Button>
                {o.status === 'waiting' && (
                  <>
                    <Button size="sm" variant="success" onClick={() => decide(o, 'approved')}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => { setView(o); setReason(''); }}>Reject</Button>
                  </>
                )}
                {o.status === 'approved' && (
                  <Button size="sm" variant="danger" onClick={() => decide(o, 'rejected')}>Revoke</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${tab} offers`} desc="Offers submitted by approved dealers land in the Waiting queue with a notification." />
      )}

      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Offer — ${view.brand_name} ${view.bike_name}` : ''} wide>
        {view && (
          <div className="space-y-4">
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Info label="Dealer" value={view.dealer_name} />
              <Info label="Location" value={[view.location_city, view.location_state].filter(Boolean).join(', ')} />
              <Info label="Variant" value={view.variant_name} />
              <Info label="Ex-showroom" value={view.ex_showroom_price != null ? inr(view.ex_showroom_price) : null} />
              <Info label="On-road" value={view.on_road_price != null ? inr(view.on_road_price) : null} />
              <Info label="Final offer" value={view.final_offer_price != null ? inr(view.final_offer_price) : null} />
              <Info label="Discount" value={view.discount_amount ? inr(view.discount_amount) : null} />
              <Info label="Exchange bonus" value={view.exchange_bonus ? inr(view.exchange_bonus) : null} />
              <Info label="Finance offer" value={view.finance_offer} />
              <Info label="Insurance" value={view.insurance_offer} />
              <Info label="Accessories" value={view.accessories} />
              <Info label="Valid until" value={view.valid_until ? formatDate(view.valid_until) : 'No expiry'} />
              <Info label="Dealer phone" value={view.contact_phone} />
              <Info label="Submitted" value={formatDate(view.created_at)} />
            </div>
            {view.status === 'rejected' && view.reject_reason && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><strong>Rejection reason:</strong> {view.reject_reason}</p>
            )}
            <p className="text-xs text-ink-400">
              {view.brand_slug && view.bike_slug ? (
                <>Live link after approval: <Link className="font-bold text-primary-600 hover:underline" to={`/new-bikes/${view.brand_slug}/${view.bike_slug}#offers`}>/new-bikes/{view.brand_slug}/{view.bike_slug}#offers</Link></>
              ) : null}
            </p>
            <Field label="Reject reason (required only for reject/revoke)">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Price is higher than the brand's MRP — please correct." />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setView(null)}>Close</Button>
              {view.status !== 'approved' ? (
                <Button variant="success" loading={busy} onClick={() => decide(view, 'approved')}>✓ Approve offer</Button>
              ) : (
                <Button variant="danger" loading={busy} onClick={() => decide(view, 'rejected')}>Revoke (hide)</Button>
              )}
              <Button variant="danger" loading={busy} onClick={() => decide(view, 'rejected')}>✕ Reject</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`font-semibold ${value ? 'text-ink-900' : 'text-ink-300'}`}>{value || 'N/A'}</p>
    </div>
  );
}

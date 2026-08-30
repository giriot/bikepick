import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getDealers, getDealerDocs, setDealerStatus, signedImageUrl } from '../../lib/api';
import type { DealerDocument, DealerProfile, DealerStatus } from '../../lib/types';
import { titleCase, formatDate, timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, StatusBadge, Tabs, Textarea, VerifiedBadge } from '../../components/ui';

const STATUSES: { id: DealerStatus | 'all'; label: string }[] = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'all', label: 'All' },
];

/**
 * /admin/dealers — dealer verification workflow:
 * view proof documents (private, time-limited links), approve, reject with
 * reason, suspend/reactivate, delete.
 */
export default function AdminDealers() {
  const { toast } = useApp();
  const [rows, setRows] = useState<DealerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DealerStatus | 'all'>('waiting');
  const [view, setView] = useState<DealerProfile | null>(null);
  const [docs, setDocs] = useState<DealerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [action, setAction] = useState<'approve' | 'reject' | 'suspend' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getDealers({ status: tab === 'all' ? undefined : tab }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openView = async (d: DealerProfile) => {
    setView(d);
    setAction(null);
    setReason('');
    setDocsLoading(true);
    setDocs([]);
    try {
      setDocs(await getDealerDocs(d.id));
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const doAction = async (newStatus: 'approved' | 'rejected' | 'suspended') => {
    if (!view) return;
    if ((newStatus === 'rejected' || newStatus === 'suspended') && !reason.trim()) {
      toast('A reason is required for reject/suspend — the dealer is told why.', 'error');
      return;
    }
    setBusy(true);
    try {
      await setDealerStatus(view.id, newStatus, reason.trim() || null);
      toast(`Dealer ${newStatus}. The dealer has been notified.`, 'success');
      setView(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reactivate = async (d: DealerProfile) => {
    try {
      await setDealerStatus(d.id, 'approved', null);
      toast(`${d.dealer_name} reactivated.`, 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const remove = async (d: DealerProfile) => {
    if (!confirm(`Permanently delete dealer "${d.dealer_name}" and their offers?`)) return;
    try {
      const sb = (await import('../../lib/supabase')).requireSupabase();
      const { error: e } = await sb.from('dealer_profiles').delete().eq('id', d.id);
      if (e) throw new Error(e.message);
      toast('Dealer deleted.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black text-ink-900">Dealer Management</h1>
      <Tabs
        tabs={STATUSES.map((s) => ({ id: s.id, label: s.label }))}
        active={tab}
        onChange={(t) => setTab(t as any)}
        className="mb-5 max-w-xl"
      />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-sm font-black text-white">{d.dealer_name.charAt(0)}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-ink-900">{d.dealer_name}</p>
                    <StatusBadge status={d.status} />
                    {d.status === 'approved' && <VerifiedBadge label="Verified" />}
                  </div>
                  <p className="text-xs text-ink-500">
                    {d.business_name || '—'} · {d.city}{d.state ? `, ${d.state}` : ''} · applied {timeAgo(d.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openView(d)}>Review</Button>
                {d.status === 'waiting' && (
                  <>
                    <Button size="sm" variant="success" onClick={() => { setView(d); setAction('approve'); }}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => { setView(d); setAction('reject'); }}>Reject</Button>
                  </>
                )}
                {d.status === 'suspended' && <Button size="sm" variant="success" onClick={() => reactivate(d)}>Reactivate</Button>}
                {(d.status === 'approved' || d.status === 'waiting') && (
                  <Button size="sm" variant="outline" onClick={async () => { setView(d); setAction('suspend'); }}>Suspend</Button>
                )}
                <Button size="sm" variant="ghost" className="!text-red-600" onClick={() => remove(d)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${tab === 'all' ? '' : tab} dealers`} desc="Dealer applications and status changes appear here with notifications." />
      )}

      {/* Review modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Dealer review — ${view.dealer_name}` : ''} wide>
        {view && (
          <div className="space-y-5">
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Info label="Business name" value={view.business_name} />
              <Info label="Contact person" value={view.contact_person} />
              <Info label="Phone" value={view.phone} />
              <Info label="Email" value={view.email} />
              <Info label="Address" value={view.address} />
              <Info label="Location" value={[view.area, view.city, view.state, view.pincode].filter(Boolean).join(', ')} />
              <Info label="GST" value={view.gst_number} />
              <Info label="Website" value={view.website} />
              <Info label="Brands" value={view.brands?.join(', ')} />
              <Info label="Applied" value={formatDate(view.created_at)} />
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">Proof documents (private)</p>
              {docsLoading ? (
                <p className="text-sm text-ink-400">Loading…</p>
              ) : docs.length ? (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold text-ink-800">{d.label || titleCase(d.doc_type)}</p>
                        <p className="text-xs text-ink-400">{titleCase(d.doc_type)} {d.is_verified ? '· ✓ verified' : ''}</p>
                      </div>
                      <a
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          const url = await signedImageUrl(d.bucket || 'private-documents', d.storage_path, 600);
                          if (url) window.open(url, '_blank', 'noopener');
                          else toast('Could not open the document.', 'error');
                        }}
                        className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50"
                      >
                        View (10 min)
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-amber-600">⚠ No proof documents uploaded. You can still approve, but verification is stronger with RC/GST/business proof.</p>
              )}
            </div>

            {action && action !== 'approve' ? (
              <Field label={`${action === 'reject' ? 'Rejection' : 'Suspend'} reason`} required hint="Shared with the dealer and stored in the audit log.">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. GST certificate is illegible — please re-upload a clear copy." />
              </Field>
            ) : (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                Approving marks the dealer as <strong>Verified</strong>. Their offers will go live after per-offer approval.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setView(null)}>Close</Button>
              {action === 'approve' && <Button variant="success" loading={busy} onClick={() => doAction('approved')}>✓ Approve dealer</Button>}
              {action === 'reject' && <Button variant="danger" loading={busy} onClick={() => doAction('rejected')}>✕ Reject</Button>}
              {action === 'suspend' && <Button variant="danger" loading={busy} onClick={() => doAction('suspended')}>Suspend dealer</Button>}
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

import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { queryUsedBikes, getUsedImages, getUsedDocs, setUsedStatus, updateUsedBike, deleteUsedBike, signedImageUrl } from '../../lib/api';
import type { UsedBike, UsedStatus } from '../../lib/types';
import { inr, fuelShort, titleCase, formatDate, timeAgo } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, StatusBadge, Tabs, Textarea, VerifiedBadge } from '../../components/ui';

const TABS: { id: string; label: string; status?: UsedStatus | UsedStatus[] }[] = [
  { id: 'pending', label: 'Waiting / changes' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'all', label: 'All' },
];

/**
 * /admin/used — used-bike approval screen.
 * Shows every submitted detail, all images, private proof documents and
 * seller info. Actions: APPROVE (sets Verified), REJECT (reason required),
 * REQUEST CHANGES (reason required), EDIT, DELETE.
 */
export default function AdminUsedBikes() {
  const { toast } = useApp();
  const [rows, setRows] = useState<UsedBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('pending');
  const [view, setView] = useState<UsedBike | null>(null);
  const [images, setImages] = useState<{ id: string; url: string; is_primary: boolean }[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [action, setAction] = useState<'' | 'approve' | 'reject' | 'changes'>('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusMap: Record<string, any> = {
        pending: ['submitted', 'waiting_approval', 'changes_required'],
        approved: 'approved',
        rejected: 'rejected',
        drafts: 'draft',
        all: undefined,
      };
      const res = await queryUsedBikes({ status: statusMap[tab], per_page: 60 });
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

  const openView = async (u: UsedBike) => {
    setView(u);
    setAction('');
    setReason('');
    setImages([]);
    setDocs([]);
    try {
      const [imgs, docs] = await Promise.all([getUsedImages(u.id), getUsedDocs(u.id)]);
      setImages((imgs as any[]).map((i) => ({ id: i.id, url: i.url, is_primary: i.is_primary })));
      setDocs(docs as any[]);
    } catch {
      /* optional */
    }
  };

  const decide = async (status: UsedStatus, verify = false) => {
    if (!view) return;
    if ((status === 'rejected' || status === 'changes_required') && !reason.trim()) {
      toast('A reason is required — the seller sees it and can fix & resubmit.', 'error');
      return;
    }
    setBusy(true);
    try {
      await setUsedStatus(view.id, status, reason.trim() || null, verify);
      toast(
        status === 'approved'
          ? 'Listing approved. It is now public and marked Verified (documents verified by you).'
          : status === 'changes_required'
            ? 'Changes requested. The seller has been notified with your reason.'
            : 'Listing rejected. The seller has been notified.',
        'success',
      );
      setView(null);
      setReason('');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!view) return;
    setBusy(true);
    try {
      await updateUsedBike(view.id, {
        price: editForm.price != null ? Number(editForm.price) : view.price,
        year: editForm.year ? Number(editForm.year) : view.year,
        km_driven: editForm.km ? Number(editForm.km) : view.km_driven,
        city: editForm.city || view.city,
        state: editForm.state || view.state,
        description: editForm.description ?? view.description,
        registration_number: editForm.registration || view.registration_number,
      } as Partial<UsedBike>);
      toast('Listing updated.', 'success');
      setEditOpen(false);
      setView(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!view) return;
    if (!confirm('Permanently delete this listing and its photos?')) return;
    setBusy(true);
    try {
      await deleteUsedBike(view.id);
      toast('Listing deleted.', 'success');
      setView(null);
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
      <h1 className="mb-5 text-2xl font-black text-ink-900">Used Bike Approvals</h1>
      <Tabs tabs={TABS.map((t) => ({ id: t.id, label: t.label }))} active={tab} onChange={setTab} className="mb-5 max-w-2xl" />
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink-100">
                  {u.primary_image_url ? <img src={u.primary_image_url} alt="" className="h-full w-full object-cover" /> : '—'}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-ink-900">{u.year ? `${u.year} ` : ''}{u.brand_name ? `${u.brand_name} ` : ''}{u.model_name}</p>
                    <StatusBadge status={u.status} />
                    {u.is_verified_listing && <VerifiedBadge label="Verified" />}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {inr(u.price)} · {u.fuel_type ? fuelShort(u.fuel_type) : ''} {u.km_driven != null ? `· ${u.km_driven.toLocaleString('en-IN')} km` : ''} · {u.city || '—'}{u.state ? `, ${u.state}` : ''} · {u.seller_name || 'seller'} · {timeAgo(u.created_at)}
                  </p>
                  {(u.status === 'rejected' || u.status === 'changes_required') && u.reject_reason && (
                    <p className="mt-1 text-xs text-amber-700">Reason: {u.reject_reason}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openView(u)}>Review</Button>
                {(u.status === 'waiting_approval' || u.status === 'submitted') && (
                  <Button size="sm" variant="success" onClick={async () => {
                    try {
                      await setUsedStatus(u.id, 'approved', null, true);
                      toast('Listing approved and marked Verified.', 'success');
                      load();
                    } catch (e: any) {
                      toast(e.message, 'error');
                    }
                  }}>Quick approve ✓</Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Queue is clear" desc={`No ${tab} used-bike listings right now.`} />
      )}

      {/* Full review modal */}
      <Modal open={!!view} onClose={() => setView(null)} title={view ? `Review — ${view.year || ''} ${view.model_name}` : ''} wide>
        {view && (
          <div className="space-y-5">
            {/* submission details */}
            <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Info label="Asking price" value={inr(view.price)} />
              <Info label="Year" value={view.year ? String(view.year) : null} />
              <Info label="KM driven" value={view.km_driven != null ? `${view.km_driven.toLocaleString('en-IN')} km` : null} />
              <Info label="Fuel" value={view.fuel_type ? fuelShort(view.fuel_type) : null} />
              <Info label="Condition" value={view.condition_grade ? titleCase(view.condition_grade) : null} />
              <Info label="Owners" value={view.owner_count ? String(view.owner_count) : null} />
              <Info label="Location" value={[view.area, view.city, view.state].filter(Boolean).join(', ')} />
              <Info label="Registration" value={view.registration_number} />
              <Info label="Insurance / service / accident" value={`${view.has_insurance ? 'insured' : 'not insured'} · ${view.service_history ? 'service history' : 'no history'} · ${view.accident_history ? 'accident disclosed' : 'no accident'}`} />
              <Info label="Seller" value={view.seller_name || view.user_id.slice(0, 8)} />
              <Info label="Seller is dealer" value={view.dealer_name || 'No'} />
              <Info label="Posted" value={formatDate(view.created_at)} />
            </div>

            <div>
              <p className="mb-1 text-xs font-black uppercase tracking-widest text-ink-400">Description</p>
              <p className="whitespace-pre-line rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{view.description || '—'}</p>
            </div>

            {/* images */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">
                Photos ({images.length} {images.length < 5 ? '⚠ below the 5-photo minimum' : '✓ meets minimum'})
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {images.map((img) => (
                  <span key={img.id} className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border border-ink-200">
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    {img.is_primary && <span className="absolute left-1 top-1 rounded bg-ink-900/80 px-1.5 text-[9px] font-bold text-white">PRIMARY</span>}
                  </span>
                ))}
                {!images.length && <p className="text-sm text-ink-400">No photos loaded.</p>}
              </div>
            </div>

            {/* proof documents */}
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">Proof documents (private · {docs.length})</p>
              {docs.length ? (
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <span className="text-sm font-semibold text-ink-800">{d.label || titleCase(d.doc_type)} <span className="text-xs font-normal text-ink-400">({titleCase(d.doc_type)})</span></span>
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
                <p className="text-sm text-amber-600">⚠ No proof documents. Approval without RC proof is allowed but the listing won't carry a documents-verified mark.</p>
              )}
            </div>

            {/* action area */}
            <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-ink-400">Verification controls</p>
              {!action && !editOpen && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="success" onClick={() => { setAction(''); decide('approved', true); }}>✓ APPROVE & mark verified</Button>
                  <Button size="sm" variant="outline" onClick={() => setAction('changes')}>Request changes</Button>
                  <Button size="sm" variant="danger" onClick={() => setAction('reject')}>Reject</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditForm({ price: String(view.price), year: view.year ? String(view.year) : '', km: view.km_driven ? String(view.km_driven) : '', city: view.city || '', state: view.state || '', registration: view.registration_number || '', description: view.description || '' });
                      setEditOpen(true);
                    }}
                  >
                    Edit listing
                  </Button>
                  <Button size="sm" variant="ghost" className="!text-red-600" onClick={doDelete}>Delete</Button>
                </div>
              )}
              {(action === 'reject' || action === 'changes') && (
                <>
                  <Field label={action === 'reject' ? 'Rejection reason' : 'What should the seller change?'} required>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Be specific — e.g. Photo 3 is blurry, please re-upload." />
                  </Field>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setAction(''); setReason(''); }}>Cancel</Button>
                    <Button size="sm" variant={action === 'reject' ? 'danger' : 'primary'} loading={busy} onClick={() => decide(action === 'reject' ? 'rejected' : 'changes_required')}>
                      {action === 'reject' ? 'Confirm rejection' : 'Send change request'}
                    </Button>
                  </div>
                </>
              )}
              {editOpen && (
                <>
                  <p className="mb-2 text-xs font-black uppercase tracking-widest text-ink-400">Edit listing values</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Price (₹)"><Input type="number" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} /></Field>
                    <Field label="Year"><Input type="number" value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} /></Field>
                    <Field label="KM driven"><Input type="number" value={editForm.km} onChange={(e) => setEditForm({ ...editForm, km: e.target.value })} /></Field>
                    <Field label="City"><Input value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} /></Field>
                    <Field label="State"><Input value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} /></Field>
                    <Field label="Registration"><Input value={editForm.registration} onChange={(e) => setEditForm({ ...editForm, registration: e.target.value })} placeholder="e.g. TN 09 AB 1234" /></Field>
                  </div>
                  <div className="mt-3">
                    <Field label="Description">
                      <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="min-h-[80px]" />
                    </Field>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button size="sm" loading={busy} onClick={saveEdit}>Save changes</Button>
                  </div>
                </>
              )}
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

import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout, { type DashTab } from '../../components/layout/DashboardLayout';
import { useApp } from '../../context/AppContext';
import {
  getMyDealer, getDealerDocs, queryOffers, createOffer, updateOffer, setOfferStatus,
  queryModels, queryUsedBikes, myEnquiries,
} from '../../lib/api';
import type { DealerDocument, DealerOffer, DealerProfile, Enquiry, UsedBike } from '../../lib/types';
import { inr, formatDate, timeAgo, titleCase } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, StatusBadge, Tabs, Textarea, VerifiedBadge } from '../../components/ui';

const tabs: DashTab[] = [
  { id: 'profile', label: 'Profile & Verification', to: '/dealer' },
  { id: 'offers', label: 'New Bike Offers', to: '/dealer/offers' },
  { id: 'used', label: 'My Used Bikes', to: '/dealer/used' },
  { id: 'enquiries', label: 'Enquiries', to: '/dealer/enquiries' },
];

export function DealerLayout() {
  return <DashboardLayout tabs={tabs} title="Dealer Dashboard" requireRole="dealer" />;
}

// ─── Profile / verification ─────────────────────────────────────────────────

export function DealerHome() {
  const { profile, toast } = useApp();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [docs, setDocs] = useState<DealerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getMyDealer();
      setDealer(d);
      if (d) setDocs(await getDealerDocs(d.id).catch(() => []));
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
  if (!dealer) {
    return (
      <EmptyState
        title="You haven't applied as a dealer yet"
        desc="Apply with your business details and proof documents. Once approved you can publish offers on any bike page."
        action={<Link to="/dealer/register" className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-700">Start dealer application →</Link>}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5 md:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-ink-900">{dealer.dealer_name}</h2>
            <p className="text-sm text-ink-500">{dealer.business_name || '—'} · {dealer.city}{dealer.state ? `, ${dealer.state}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {dealer.status === 'approved' && <VerifiedBadge label="Verified Dealer" />}
            <StatusBadge status={dealer.status} />
          </div>
        </div>
        <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-ink-100 pt-4 text-sm sm:grid-cols-2">
          <Item label="Contact person" value={dealer.contact_person} />
          <Item label="Phone" value={dealer.phone} />
          <Item label="Email" value={dealer.email} />
          <Item label="GST" value={dealer.gst_number} />
          <Item label="Address" value={dealer.address} />
          <Item label="Brands" value={dealer.brands?.length ? dealer.brands.join(', ') : null} />
        </dl>
        {dealer.reject_reason && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800"><strong>Admin note:</strong> {dealer.reject_reason}</p>
        )}
        {dealer.status === 'waiting' && (
          <p className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
            ⏳ Your application is under review. We verify business proof and identity before approving. You'll be notified here.
          </p>
        )}
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-ink-400">Proof documents</h3>
        {docs.length ? (
          <ul className="mt-3 space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-ink-700">{d.label || titleCase(d.doc_type)}</span>
                {d.is_verified ? <span className="text-xs font-bold text-emerald-600">✓ verified</span> : <span className="text-xs text-ink-400">on file</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-400">No documents on file.</p>
        )}
        <Link to="/dealer/register" className="mt-4 block rounded-lg border border-ink-300 px-4 py-2 text-center text-sm font-bold text-ink-700 hover:bg-ink-50">
          Update application / documents
        </Link>
      </Card>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className={`font-semibold ${value ? 'text-ink-900' : 'text-ink-300'}`}>{value || 'N/A'}</dd>
    </div>
  );
}

// ─── Offers ─────────────────────────────────────────────────────────────────

export function DealerOffers() {
  const { profile, toast } = useApp();
  const [dealer, setDealer] = useState<DealerProfile | null>(null);
  const [rows, setRows] = useState<DealerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getMyDealer();
      setDealer(d);
      if (d) {
        const res = await queryOffers({ dealer_id: d.id, status: tab === 'all' ? undefined : tab });
        setRows(res.rows);
      }
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
  if (!dealer || dealer.status !== 'approved') {
    return (
      <EmptyState
        title={dealer ? 'Offers unlock after approval' : 'Apply as a dealer to publish offers'}
        desc="Only approved dealers can publish offers. Your application is visible to the admin team."
        action={<Link to="/dealer/register" className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-bold text-white">Check my application →</Link>}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'waiting', label: 'Waiting' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Button onClick={() => setFormOpen(true)} disabled={dealer.status !== 'approved'}>+ Add Offer</Button>
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((o) => (
            <Card key={o.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink-900">{o.brand_name} {o.bike_name}</p>
                  {o.variant_name && <span className="text-xs text-ink-400">· {o.variant_name}</span>}
                  <StatusBadge status={o.status} />
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {inr(o.final_offer_price || o.ex_showroom_price)} · {o.location_city || '—'}
                  {o.discount_amount ? ` · discount ${inr(o.discount_amount)}` : ''}
                  {o.exchange_bonus ? ` · exchange bonus ${inr(o.exchange_bonus)}` : ''}
                </p>
                {o.status === 'rejected' && o.reject_reason && (
                  <p className="mt-1 text-xs text-amber-700"><strong>Reason:</strong> {o.reject_reason}</p>
                )}
              </div>
              <div className="flex gap-2">
                {(o.status === 'waiting' || o.status === 'rejected') && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    try {
                      await updateOffer(o.id, { status: 'waiting' });
                      toast('Offer resubmitted for approval.', 'success');
                      load();
                    } catch (e: any) { toast(e.message, 'error'); }
                  }}>
                    Resubmit
                  </Button>
                )}
                <Link to={o.brand_slug && o.bike_slug ? `/new-bikes/${o.brand_slug}/${o.bike_slug}#offers` : '/new-bikes'} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50">
                  View on bike page
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title={`No ${tab === 'all' ? '' : tab + ' '}offers yet`}
          desc="Create your first offer — pick a bike, set your best price and bonuses. It goes live after admin approval."
          action={<Button onClick={() => setFormOpen(true)}>+ Add your first offer</Button>}
        />
      )}
      <OfferForm open={formOpen} onClose={() => setFormOpen(false)} dealer={dealer} onSaved={load} />
    </div>
  );
}

function toastShim(msg: string, kind: 'success' | 'error') {
  // tiny helper so nested components stay light
  // eslint-disable-next-line no-console
  if (kind === 'error') console.error(msg);
}

import { useApp as _useApp } from '../../context/AppContext';

function OfferForm({ open, onClose, dealer, onSaved }: { open: boolean; onClose: () => void; dealer: DealerProfile; onSaved: () => void }) {
  const { toast } = _useApp();
  const [models, setModels] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [modelId, setModelId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [city, setCity] = useState(dealer.city || '');
  const [exPrice, setExPrice] = useState('');
  const [onRoad, setOnRoad] = useState('');
  const [discount, setDiscount] = useState('');
  const [exchange, setExchange] = useState('');
  const [finance, setFinance] = useState('');
  const [insurance, setInsurance] = useState('');
  const [accessories, setAccessories] = useState('');
  const [finalPrice, setFinalPrice] = useState('');
  const [contactPhone, setContactPhone] = useState(dealer.phone || '');
  const [validUntil, setValidUntil] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingModels(true);
    queryModels({ per_page: 100, sort: 'popular' })
      .then((res) => setModels(res.rows))
      .catch(() => null)
      .finally(() => setLoadingModels(false));
  }, [open]);

  useEffect(() => {
    if (!modelId) {
      setVariants([]);
      return;
    }
    import('../../lib/api')
      .then((m) => m.getVariants(modelId))
      .then(setVariants)
      .catch(() => setVariants([]));
  }, [modelId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!modelId) return setError('Select a bike.');
    if (!city.trim()) return setError('Enter the location city.');
    if (!exPrice || Number(exPrice) <= 0) return setError('Enter the ex-showroom price.');
    if (!contactPhone) return setError('Enter a contact phone.');
    setBusy(true);
    try {
      await createOffer({
        dealer_id: dealer.id,
        bike_model_id: modelId,
        variant_id: variantId || null,
        location_city: city.trim(),
        location_state: dealer.state || null,
        ex_showroom_price: Number(exPrice),
        on_road_price: onRoad ? Number(onRoad) : null,
        discount_amount: discount ? Number(discount) : null,
        exchange_bonus: exchange ? Number(exchange) : null,
        finance_offer: finance.trim() || null,
        insurance_offer: insurance.trim() || null,
        accessories: accessories.trim() || null,
        final_offer_price: finalPrice ? Number(finalPrice) : Number(exPrice),
        contact_phone: contactPhone.replace(/\s/g, ''),
        valid_until: validUntil || null,
      });
      toast('Offer submitted! It will appear on the bike page after admin approval.', 'success');
      onClose();
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Could not submit the offer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create dealer offer" wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Bike" required>
          <Select value={modelId} onChange={(e) => { setModelId(e.target.value); setVariantId(''); }} disabled={loadingModels}>
            <option value="">{loadingModels ? 'Loading bikes…' : 'Select bike…'}</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.brand_name} {m.name} — {inr(m.price_start)}</option>
            ))}
          </Select>
        </Field>
        {variants.length > 0 && (
          <Field label="Variant (optional)">
            <Select value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Whole model</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {v.price != null ? inr(v.price) : 'N/A'}</option>
              ))}
            </Select>
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ex-showroom price (₹)" required>
            <Input type="number" value={exPrice} onChange={(e) => setExPrice(e.target.value)} placeholder="e.g. 125000" />
          </Field>
          <Field label="On-road price (₹)">
            <Input type="number" value={onRoad} onChange={(e) => setOnRoad(e.target.value)} placeholder="e.g. 142000" />
          </Field>
          <Field label="Discount (₹)">
            <Input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="e.g. 5000" />
          </Field>
          <Field label="Exchange bonus (₹)">
            <Input type="number" value={exchange} onChange={(e) => setExchange(e.target.value)} placeholder="e.g. 10000" />
          </Field>
          <Field label="Location city" required>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Contact phone" required>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" />
          </Field>
          <Field label="Finance offer">
            <Input value={finance} onChange={(e) => setFinance(e.target.value)} placeholder="e.g. 8.99% APR, zero down" />
          </Field>
          <Field label="Insurance offer">
            <Input value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="e.g. Free 1-year comprehensive" />
          </Field>
          <Field label="Free accessories">
            <Input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="e.g. cover, top box, floor mat" />
          </Field>
          <Field label="Final offer price (₹)" hint="Defaults to ex-showroom if empty.">
            <Input type="number" value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Valid until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Submit for approval</Button>
        </div>
        <p className="text-xs text-ink-400">Every offer is reviewed by an admin before going live. Fake or misleading offers get the dealer suspended.</p>
      </form>
    </Modal>
  );
}

// ─── Dealer used bikes ──────────────────────────────────────────────────────

export function DealerUsed() {
  const { profile } = useApp();
  const [rows, setRows] = useState<UsedBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryUsedBikes({ user_id: profile!.id, status: ['draft', 'waiting_approval', 'approved', 'changes_required', 'rejected', 'sold'], per_page: 50 });
      setRows(res.rows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink-500">Listings posted from your dealer account.</p>
        <Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">+ Post Used Bike</Link>
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((u) => (
            <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-ink-900">{u.year} {u.model_name}</p>
                  <StatusBadge status={u.status} />
                </div>
                <p className="text-sm text-ink-500">{inr(u.price)} · {u.city || '—'}</p>
              </div>
              <div className="flex gap-2">
                <Link to={`/used-bikes/${u.id}`} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50">View</Link>
                <Link to={`/account/used/${u.id}/edit`} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50">Edit</Link>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No used bike listings" desc="Post inventory from your dealership — it goes live after admin verification." action={<Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">+ Post your first bike</Link>} />
      )}
    </div>
  );
}

// ─── Dealer enquiries ───────────────────────────────────────────────────────

export function DealerEnquiries() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await myEnquiries());
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
  if (!rows.length) {
    return <EmptyState title="No enquiries yet" desc="When buyers request your offers or listings, they appear here with their callback number." />;
  }
  return (
    <div className="space-y-2">
      {rows.map((e) => (
        <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-ink-900">{e.from_name}</p>
              <StatusBadge status={e.status} />
            </div>
            <p className="text-sm text-ink-500">{e.type === 'dealer_offer' ? 'Dealer offer enquiry' : 'Contact / callback'} · {timeAgo(e.created_at)}</p>
            {e.message && <p className="mt-1 max-w-xl text-xs italic text-ink-400">“{e.message}”</p>}
          </div>
          <a href={`tel:${e.from_phone}`} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700">
            {e.from_phone} — Call
          </a>
        </Card>
      ))}
    </div>
  );
}

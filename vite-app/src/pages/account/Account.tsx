import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout, { type DashTab } from '../../components/layout/DashboardLayout';
import { useApp } from '../../context/AppContext';
import {
  queryUsedBikes, getMyFavorites, myEnquiries, myNotifications, markNotificationRead,
  markAllNotificationsRead, updateMyProfile, deleteUsedBike, setUsedStatus,
} from '../../lib/api';
import type { AppNotification, Enquiry, UsedBike } from '../../lib/types';
import { inr, fuelShort, formatDate, timeAgo, titleCase } from '../../lib/format';
import { Button, Card, EmptyState, ErrorBlock, Field, Input, LoadingBlock, StatusBadge, VerifiedBadge } from '../../components/ui';
import { UsedCard } from '../UsedBikes';

const tabs: DashTab[] = [
  { id: 'profile', label: 'Profile', to: '/account' },
  { id: 'used', label: 'My Used Bikes', to: '/account/used' },
  { id: 'saved', label: 'Saved Bikes', to: '/account/saved' },
  { id: 'enquiries', label: 'Enquiries', to: '/account/enquiries' },
  { id: 'notifications', label: 'Notifications', to: '/account/notifications' },
];

export function AccountLayout() {
  return <DashboardLayout tabs={tabs} title="My Account" />;
}

// ─── Profile tab ────────────────────────────────────────────────────────────

export function AccountHome() {
  const { profile, refreshProfile, unreadNotifs, fav } = useApp();
  const [name, setName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await updateMyProfile({ full_name: name.trim(), phone: phone.trim() || null });
      await refreshProfile();
      setMsg('Profile updated.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-5 md:col-span-2">
        <h2 className="mb-4 text-lg font-black text-ink-900">Profile</h2>
        <form onSubmit={save} className="space-y-4">
          <Field label="Email (cannot be changed)">
            <Input value={profile?.email || ''} disabled />
          </Field>
          <Field label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone" hint="Used to prefill enquiry forms. Never shown publicly.">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </Field>
          {msg && <p className="text-sm font-semibold text-emerald-600">{msg}</p>}
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <Button loading={busy}>Save profile</Button>
        </form>
      </Card>
      <div className="space-y-4">
        <Card className="p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-ink-400">Quick stats</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-ink-500">Saved new bikes</span><strong>{fav.bikes.length}</strong></li>
            <li className="flex justify-between"><span className="text-ink-500">Saved used bikes</span><strong>{fav.used.length}</strong></li>
            <li className="flex justify-between"><span className="text-ink-500">Unread notifications</span><strong>{unreadNotifs}</strong></li>
            <li className="flex justify-between"><span className="text-ink-500">Member since</span><strong>{profile ? formatDate(profile.created_at) : '—'}</strong></li>
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-ink-400">Quick actions</h3>
          <div className="mt-3 space-y-2">
            <Link to="/post-used-bike" className="block rounded-lg bg-primary-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary-700">Sell a used bike</Link>
            <Link to="/dealer/register" className="block rounded-lg border border-ink-300 px-4 py-2.5 text-center text-sm font-bold text-ink-700 hover:bg-ink-50">Register as dealer</Link>
            <Link to="/compare" className="block rounded-lg border border-ink-300 px-4 py-2.5 text-center text-sm font-bold text-ink-700 hover:bg-ink-50">Compare bikes</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── My Used Bikes tab ──────────────────────────────────────────────────────

export function AccountUsed() {
  const { profile, toast } = useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<UsedBike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UsedBike | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await queryUsedBikes({ user_id: profile!.id, status: ['draft', 'submitted', 'waiting_approval', 'approved', 'changes_required', 'rejected', 'sold'], per_page: 50 });
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

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      await deleteUsedBike(confirmDelete.id);
      toast('Listing deleted.', 'success');
      setConfirmDelete(null);
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const markSold = async (u: UsedBike) => {
    setBusyId(u.id);
    try {
      await setUsedStatus(u.id, 'sold', null);
      toast('Marked as sold.', 'success');
      load();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <LoadingBlock label="Loading your listings…" />;
  if (error) return <ErrorBlock message={error} onRetry={load} />;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-ink-500">{rows.length} listing{rows.length === 1 ? '' : 's'}</p>
        <Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white hover:bg-primary-700">+ Add Used Bike</Link>
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((u) => (
            <Card key={u.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
              <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                {u.primary_image_url ? (
                  <img src={u.primary_image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-ink-300">no photo</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink-900">{u.year ? `${u.year} ` : ''}{u.model_name}</p>
                  <StatusBadge status={u.status} />
                  {u.is_verified_listing && <VerifiedBadge label="Verified" />}
                </div>
                <p className="mt-1 text-sm text-ink-500">
                  {inr(u.price)} · {u.fuel_type ? fuelShort(u.fuel_type) : ''} {u.km_driven != null ? `· ${u.km_driven.toLocaleString('en-IN')} km` : ''} · {u.city || 'India'}
                </p>
                {(u.status === 'rejected' || u.status === 'changes_required') && u.reject_reason && (
                  <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
                    <strong>Admin note:</strong> {u.reject_reason}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(u.status === 'draft' || u.status === 'changes_required' || u.status === 'rejected') && (
                  <Button size="sm" onClick={() => navigate(`/account/used/${u.id}/edit`)}>Edit</Button>
                )}
                {u.status === 'approved' && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => markSold(u)} loading={busyId === u.id}>Mark Sold</Button>
                    <Link to={`/used-bikes/${u.id}`} className="rounded-lg border border-ink-300 px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50">View</Link>
                  </>
                )}
                {u.status === 'approved' && <Button size="sm" variant="ghost" onClick={() => navigate(`/account/used/${u.id}/edit`)}>Edit</Button>}
                <Button size="sm" variant="danger" onClick={() => setConfirmDelete(u)}>Delete</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You haven't listed any bikes yet"
          desc="Selling a bike? Post it in 5 minutes — 5 photos and your RC get it verified faster."
          action={<Link to="/post-used-bike" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">+ Add your first used bike</Link>}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-lift">
            <h3 className="text-lg font-bold text-ink-900">Delete this listing?</h3>
            <p className="mt-1 text-sm text-ink-500">{confirmDelete.year} {confirmDelete.model_name} — this also removes its photos. This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="danger" loading={busyId === confirmDelete.id} onClick={doDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Saved tab ──────────────────────────────────────────────────────────────

export function AccountSaved() {
  const { fav, favLoaded, refreshSettings } = useApp();
  const navigate = useNavigate();
  const [newBikes, setNewBikes] = useState<any[]>([]);
  const [used, setUsed] = useState<UsedBike[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!favLoaded) return;
    (async () => {
      setLoading(true);
      try {
        const sb = (await import('../../lib/supabase')).requireSupabase();
        const [b, u] = await Promise.all([
          fav.bikes.length
            ? sb.from('bike_models').select('id, name, slug, price_start, fuel_type, brands ( name, slug )').in('id', fav.bikes)
            : Promise.resolve({ data: [] }),
          fav.used.length
            ? import('../../lib/api').then((m) => m.queryUsedBikes({ per_page: 50 }))
            : Promise.resolve({ rows: [] as UsedBike[] }),
        ]);
        setNewBikes(((b.data || []) as any[]).map((m) => ({ ...m, brand_name: m.brands?.name, brand_slug: m.brands?.slug })));
        setUsed((u as { rows: UsedBike[] }).rows.filter((x) => fav.used.includes(x.id)));
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
    })();
  }, [fav, favLoaded]);

  if (!favLoaded || loading) return <LoadingBlock label="Loading saved items…" />;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-black text-ink-900">Saved New Bikes ({newBikes.length})</h2>
        {newBikes.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {newBikes.map((m: any) => (
              <Card key={m.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-ink-900">{m.brand_name} {m.name}</p>
                  <p className="text-xs text-ink-400">{fuelShort(m.fuel_type)} · {inr(m.price_start)}</p>
                </div>
                <Link to={`/new-bikes/${m.brand_slug}/${m.slug}`} className="shrink-0 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-700">View</Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No saved bikes" desc="Tap the heart on any bike to save it here." />
        )}
      </section>
      <section>
        <h2 className="mb-3 text-lg font-black text-ink-900">Saved Used Bikes ({used.length})</h2>
        {used.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {used.map((u) => (
              <Card key={u.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-bold text-ink-900">{u.year} {u.model_name}</p>
                  <p className="text-xs text-ink-400">{inr(u.price)} · {u.city || 'India'}</p>
                </div>
                <Link to={`/used-bikes/${u.id}`} className="shrink-0 rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-700">View</Link>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="No saved used bikes" desc="Save used-bike listings to track them here." />
        )}
      </section>
    </div>
  );
}

// ─── Enquiries tab ──────────────────────────────────────────────────────────

export function AccountEnquiries() {
  const { profile } = useApp();
  const [sent, setSent] = useState<Enquiry[]>([]);
  const [received, setReceived] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const uid = profile?.id;
      const all = await myEnquiries();
      setSent(all.filter((e) => e.from_user_id === uid));
      setReceived(all.filter((e) => e.to_user_id === uid));
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
    <div className="space-y-8">
      <Section title={`Sent by you (${sent.length})`}>
        {sent.length ? (
          <div className="space-y-2">
            {sent.map((e) => (
              <EnquiryRow key={e.id} e={e} />
            ))}
          </div>
        ) : (
          <EmptyState title="No enquiries sent yet" desc="Use “Contact Seller” or “Request Callback” on any bike or listing." />
        )}
      </Section>
      <Section title={`Received (${received.length})`}>
        {received.length ? (
          <div className="space-y-2">
            {received.map((e) => (
              <EnquiryRow key={e.id} e={e} incoming />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-400">Enquiries about your listings or offers will appear here.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-black text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function EnquiryRow({ e, incoming = false }: { e: Enquiry; incoming?: boolean }) {
  const label =
    e.type === 'dealer_offer' ? 'Dealer offer / callback' : e.type === 'contact_seller' ? 'Contact seller' : e.type === 'callback' ? 'Callback' : 'General';
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-ink-900">{incoming ? `${e.from_name} — ${label}` : label}</p>
          <StatusBadge status={e.status} />
        </div>
        <p className="mt-1 text-sm text-ink-500">
          {incoming ? `${e.from_phone}${e.from_email ? ` · ${e.from_email}` : ''}` : 'To: seller/dealer'} · {timeAgo(e.created_at)}
        </p>
        {e.message && <p className="mt-1 max-w-xl text-xs italic text-ink-400">“{e.message}”</p>}
      </div>
      {incoming && (
        <a href={`tel:${e.from_phone}`} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
          Call back
        </a>
      )}
    </Card>
  );
}

// ─── Notifications tab ──────────────────────────────────────────────────────

export function AccountNotifications() {
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshNotifCount } = useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await myNotifications());
      refreshNotifCount();
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [refreshNotifCount]);

  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    await markAllNotificationsRead();
    setRows((r) => r.map((n) => ({ ...n, is_read: true })));
    refreshNotifCount();
  };

  if (loading) return <LoadingBlock />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink-500">{rows.filter((n) => !n.is_read).length} unread</p>
        <Button size="sm" variant="outline" onClick={markAll}>Mark all read</Button>
      </div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((n) => (
            <button
              key={n.id}
              onClick={async () => {
                if (!n.is_read) {
                  await markNotificationRead(n.id);
                  setRows((r) => r.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
                }
              }}
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${n.is_read ? 'border-ink-200 bg-white' : 'border-primary-300 bg-primary-50/50'}`}
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? 'bg-ink-300' : 'bg-primary-600'}`} />
              <span className="flex-1">
                <span className="block text-sm font-bold text-ink-900">{n.title}</span>
                {n.body && <span className="block text-sm text-ink-500">{n.body}</span>}
                <span className="mt-0.5 block text-xs text-ink-400">{timeAgo(n.created_at)}</span>
              </span>
              {n.link && (
                <Link to={n.link} className="shrink-0 text-xs font-bold text-primary-600 hover:underline">
                  Open →
                </Link>
              )}
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No notifications yet" desc="Approvals, rejections and new enquiries will notify you here." />
      )}
    </div>
  );
}

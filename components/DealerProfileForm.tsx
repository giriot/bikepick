'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DealerProfileForm({ dealer, allBrands }: { dealer: any; allBrands: { id: string; name: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(() => {
    try { return JSON.parse(dealer.brands || '[]'); } catch { return []; }
  });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/dealer/profile', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...Object.fromEntries(fd.entries()), brands: selected }),
    });
    const json = await res.json();
    if (json.ok) { setMsg('Saved.'); router.refresh(); } else setErr(json.error || 'Could not save');
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {msg && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{msg}</p>}
      {err && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{err}</p>}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div><label className="label" htmlFor="business_name">Dealership name</label>
          <input id="business_name" defaultValue={dealer.business_name} disabled className="field bg-surface text-ink-mute" />
          <p className="hint">Contact support to change the registered business name.</p></div>
        <div><label className="label" htmlFor="dealer_name">Contact person</label>
          <input id="dealer_name" name="dealer_name" required defaultValue={dealer.dealer_name} className="field" /></div>
        <div><label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" required defaultValue={dealer.phone} className="field" /></div>
        <div><label className="label" htmlFor="whatsapp">WhatsApp</label>
          <input id="whatsapp" name="whatsapp" defaultValue={dealer.whatsapp || ''} className="field" /></div>
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required defaultValue={dealer.email} className="field" /></div>
        <div><label className="label" htmlFor="gstin">GSTIN</label>
          <input id="gstin" defaultValue={dealer.gstin || '—'} disabled className="field bg-surface text-ink-mute" /></div>
      </div>

      <div><label className="label" htmlFor="address">Address</label>
        <textarea id="address" name="address" required rows={2} defaultValue={dealer.address} className="field" /></div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <div><label className="label" htmlFor="city">City</label><input id="city" name="city" required defaultValue={dealer.city} className="field" /></div>
        <div><label className="label" htmlFor="state">State</label><input id="state" name="state" required defaultValue={dealer.state} className="field" /></div>
        <div><label className="label" htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" required defaultValue={dealer.pincode} className="field" /></div>
      </div>

      <div>
        <span className="label">Brands you sell</span>
        <div className="flex flex-wrap gap-2">
          {allBrands.map((b) => {
            const on = selected.includes(b.name);
            return <button key={b.id} type="button" aria-pressed={on} className={`chip ${on ? 'chip-active' : ''}`}
              onClick={() => setSelected(on ? selected.filter((x) => x !== b.name) : [...selected, b.name])}>{b.name}</button>;
          })}
        </div>
      </div>

      <div><label className="label" htmlFor="about">About your dealership</label>
        <textarea id="about" name="about" rows={3} defaultValue={dealer.about || ''} className="field" /></div>

      <button className="btn-primary btn-sm" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

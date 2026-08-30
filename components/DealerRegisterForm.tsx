'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function DealerRegisterForm({ brands, defaults }: {
  brands: { id: string; name: string }[];
  defaults: { name: string; phone: string; email: string; city: string };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setFields({});
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/dealer/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...Object.fromEntries(fd.entries()), brands: selected }),
    });
    const json = await res.json();
    if (!json.ok) { setError(json.error || 'Could not submit'); setFields(json.fields || {}); setBusy(false); return; }
    router.push('/dealer');
    router.refresh();
  }

  const Err = ({ name }: { name: string }) => fields[name] ? <p className="err">{fields[name]}</p> : null;

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-800">{error}</div>}

      <fieldset className="space-y-3.5">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Business</legend>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div><label className="label" htmlFor="business_name">Dealership name</label>
            <input id="business_name" name="business_name" required className="field" placeholder="Sri Balaji Motors" /><Err name="business_name" /></div>
          <div><label className="label" htmlFor="dealer_name">Contact person</label>
            <input id="dealer_name" name="dealer_name" required defaultValue={defaults.name} className="field" /><Err name="dealer_name" /></div>
          <div><label className="label" htmlFor="phone">Phone</label>
            <input id="phone" name="phone" required inputMode="numeric" defaultValue={defaults.phone} className="field" placeholder="10-digit mobile" /><Err name="phone" /></div>
          <div><label className="label" htmlFor="whatsapp">WhatsApp (optional)</label>
            <input id="whatsapp" name="whatsapp" inputMode="numeric" className="field" /><Err name="whatsapp" /></div>
          <div><label className="label" htmlFor="email">Business email</label>
            <input id="email" name="email" type="email" required defaultValue={defaults.email} className="field" /><Err name="email" /></div>
          <div><label className="label" htmlFor="gstin">GSTIN (optional)</label>
            <input id="gstin" name="gstin" className="field" placeholder="22AAAAA0000A1Z5" /><Err name="gstin" />
            <p className="hint">Speeds up verification considerably.</p></div>
        </div>
      </fieldset>

      <fieldset className="space-y-3.5">
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Showroom address</legend>
        <div><label className="label" htmlFor="address">Address</label>
          <textarea id="address" name="address" required rows={2} className="field" /><Err name="address" /></div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div><label className="label" htmlFor="city">City</label>
            <input id="city" name="city" required defaultValue={defaults.city} className="field" /><Err name="city" /></div>
          <div><label className="label" htmlFor="state">State</label>
            <input id="state" name="state" required className="field" /><Err name="state" /></div>
          <div><label className="label" htmlFor="pincode">Pincode</label>
            <input id="pincode" name="pincode" required inputMode="numeric" className="field" /><Err name="pincode" /></div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">Brands you sell</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {brands.map((b) => {
            const on = selected.includes(b.name);
            return (
              <button key={b.id} type="button" onClick={() => setSelected(on ? selected.filter((x) => x !== b.name) : [...selected, b.name])}
                aria-pressed={on} className={`chip ${on ? 'chip-active' : ''}`}>{b.name}</button>
            );
          })}
        </div>
      </fieldset>

      <div><label className="label" htmlFor="about">About your dealership (optional)</label>
        <textarea id="about" name="about" rows={3} className="field" placeholder="Years in business, services offered, workshop facilities…" /></div>

      <div className="rounded-xl bg-surface p-4 text-[12.5px] leading-5 text-ink-mute">
        Submitting starts a verification review. We check your business details before your dealership appears publicly or
        can publish offers. By continuing you accept the <Link href="/legal/terms" className="underline">Terms of Use</Link>.
      </div>

      <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
    </form>
  );
}

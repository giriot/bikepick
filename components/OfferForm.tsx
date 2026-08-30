'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inr } from '@/lib/format';

export function OfferForm({ products, city }: {
  products: { id: string; label: string; price: number | null }[]; city: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState(products[0]?.id || '');

  const selected = products.find((p) => p.id === productId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setFields({});
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/dealer/offers', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries([...fd.entries()].filter(([, v]) => v !== ''))),
    });
    const json = await res.json();
    setBusy(false);
    if (!json.ok) { setError(json.error || 'Could not save'); setFields(json.fields || {}); return; }
    setOpen(false);
    router.refresh();
  }

  if (!open) return <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>Create an offer</button>;

  return (
    <div className="card mt-2 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">New offer</h3>
        <button onClick={() => setOpen(false)} className="btn-ghost btn-sm">Cancel</button>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-3.5">
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-800">{error}</p>}
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="product_id">Model</label>
            <select id="product_id" name="product_id" className="field" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            {selected?.price != null && <p className="hint">Listed ex-showroom: {inr(selected.price)}</p>}
          </div>
          <div><label className="label" htmlFor="city">City</label>
            <input id="city" name="city" required defaultValue={city} className="field" /></div>
          <div><label className="label" htmlFor="on_road">Your on-road price (₹)</label>
            <input id="on_road" name="on_road" type="number" min={0} step={100} className="field" /></div>
          <div><label className="label" htmlFor="discount">Cash discount (₹)</label>
            <input id="discount" name="discount" type="number" min={0} step={100} className="field" /></div>
          <div><label className="label" htmlFor="exchange_bonus">Exchange bonus (₹)</label>
            <input id="exchange_bonus" name="exchange_bonus" type="number" min={0} step={100} className="field" /></div>
          <div><label className="label" htmlFor="insurance">Insurance included (₹)</label>
            <input id="insurance" name="insurance" type="number" min={0} step={100} className="field" /></div>
          <div><label className="label" htmlFor="finance_offer">Finance offer</label>
            <input id="finance_offer" name="finance_offer" className="field" placeholder="e.g. 8.99% for 36 months, zero processing fee" /></div>
          <div><label className="label" htmlFor="accessories_offer">Accessories offer</label>
            <input id="accessories_offer" name="accessories_offer" className="field" placeholder="e.g. Helmet and floor mat free" /></div>
          <div><label className="label" htmlFor="start_date">Valid from</label>
            <input id="start_date" name="start_date" type="date" className="field" /></div>
          <div><label className="label" htmlFor="end_date">Valid till</label>
            <input id="end_date" name="end_date" type="date" className="field" />
            <p className="hint">Leave blank and we expire it automatically after the default window.</p></div>
        </div>
        <div>
          <label className="label" htmlFor="offer_text">Offer description</label>
          <textarea id="offer_text" name="offer_text" required minLength={5} rows={3} className="field"
            placeholder="Describe exactly what the buyer gets and any condition attached — e.g. discount applies with in-house finance only." />
          {fields.offer_text && <p className="err">{fields.offer_text}</p>}
        </div>
        <p className="rounded-xl bg-surface p-3 text-[12px] leading-5 text-ink-mute">
          Offers are reviewed by our team before they go public. Anything misleading is rejected, and repeated misleading
          offers suspend the dealership. Buyers see your business name against every offer.
        </p>
        <button className="btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
      </form>
    </div>
  );
}

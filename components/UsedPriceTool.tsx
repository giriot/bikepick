'use client';
import { useState } from 'react';
import { inr } from '@/lib/format';

interface Brand { name: string; models: { id: string; name: string; price: number | null }[] }

export function UsedPriceTool({ brands }: { brands: Brand[] }) {
  const [brand, setBrand] = useState(brands[0]?.name || '');
  const [productId, setProductId] = useState(brands[0]?.models[0]?.id || '');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const models = brands.find((b) => b.name === brand)?.models || [];

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    const res = await fetch('/api/used-bikes/estimate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, model_name: models.find((m) => m.id === productId)?.name || 'Unknown' }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error || 'Could not estimate'); else setResult(json.data);
    setBusy(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={submit} className="card h-max space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="brand_name">Brand</label>
            <select id="brand_name" name="brand_name" className="field" value={brand}
              onChange={(e) => { setBrand(e.target.value); setProductId(brands.find((b) => b.name === e.target.value)?.models[0]?.id || ''); }}>
              {brands.map((b) => <option key={b.name}>{b.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="product_id">Model</label>
            <select id="product_id" name="product_id" className="field" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="manufacture_year">Year</label>
            <input id="manufacture_year" name="manufacture_year" type="number" required min={1990} max={new Date().getFullYear()} defaultValue={new Date().getFullYear() - 4} className="field" /></div>
          <div><label className="label" htmlFor="km_driven">Kilometres</label>
            <input id="km_driven" name="km_driven" type="number" required min={0} step={500} defaultValue={25000} className="field" /></div>
          <div><label className="label" htmlFor="owners">Owners</label>
            <select id="owners" name="owners" className="field" defaultValue="1">{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}{n === 4 ? '+' : ''}</option>)}</select></div>
          <div><label className="label" htmlFor="condition">Condition</label>
            <select id="condition" name="condition" className="field" defaultValue="good">
              <option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="needs_work">Needs work</option>
            </select></div>
          <div><label className="label" htmlFor="service_history">Service history</label>
            <select id="service_history" name="service_history" className="field" defaultValue="partial">
              <option value="full_authorised">Full, authorised</option><option value="partial">Partial</option><option value="local">Local mechanic</option><option value="none">None</option>
            </select></div>
          <div><label className="label" htmlFor="insurance_status">Insurance</label>
            <select id="insurance_status" name="insurance_status" className="field" defaultValue="comprehensive">
              <option value="comprehensive">Comprehensive</option><option value="third_party">Third party</option><option value="expired">Expired</option><option value="none">None</option>
            </select></div>
          <div><label className="label" htmlFor="accident_history">Accident history</label>
            <select id="accident_history" name="accident_history" className="field" defaultValue="none">
              <option value="none">None</option><option value="minor">Minor</option><option value="major">Major</option>
            </select></div>
          <div><label className="label" htmlFor="city">City</label>
            <input id="city" name="city" className="field" placeholder="Coimbatore" /></div>
        </div>
        <div><label className="label" htmlFor="asking_price">Asking price (optional)</label>
          <input id="asking_price" name="asking_price" type="number" min={0} step={1000} className="field" placeholder="Check if a price is fair" /></div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Calculating…' : 'Estimate price'}</button>
      </form>

      <div>
        {error && <div className="card border-rose-200 bg-rose-50 p-5 text-[13px] text-rose-800">{error}</div>}
        {!result && !error && (
          <div className="card grid h-full min-h-[240px] place-items-center p-8 text-center">
            <div>
              <p className="text-[14px] font-semibold">Your estimate appears here</p>
              <p className="mt-1 text-[13px] text-ink-mute">Fill in the details on the left. Every factor that moves the price is shown.</p>
            </div>
          </div>
        )}
        {result && result.available === false && (
          <div className="card p-6"><p className="text-[14px] font-semibold">No reference price</p>
            <p className="mt-1 text-[13px] leading-6 text-ink-mute">{result.message}</p></div>
        )}
        {result?.available && (
          <div className="space-y-4">
            <div className="card bg-gradient-to-br from-brand-50 to-white p-6">
              <p className="text-[12.5px] font-medium text-brand-700">Estimated fair market range</p>
              <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.04em]">{inr(result.min)} – {inr(result.max)}</p>
              <p className="mt-2 text-[13px] text-ink-mute">Most likely price: <strong className="text-ink">{inr(result.fair)}</strong></p>
              {result.verdict && (
                <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-[12.5px] font-semibold ${
                  result.verdict.verdict === 'good_deal' ? 'bg-emerald-100 text-emerald-800'
                  : result.verdict.verdict === 'fair_price' ? 'bg-brand-100 text-brand-800' : 'bg-amber-100 text-amber-900'}`}>
                  {result.verdict.label} — {result.verdict.note}
                </p>
              )}
            </div>
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold">What moved the price</h3>
              <ul className="mt-3 space-y-2.5">
                {result.factors.map((f: any) => (
                  <li key={f.label}>
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-medium">{f.label}</span>
                      <span className={`tabular-nums font-semibold ${f.effect >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {f.effect >= 0 ? '+' : ''}{(f.effect * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                      <div className={`h-full rounded-full ${f.effect >= 0 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                        style={{ width: `${Math.min(100, Math.abs(f.effect) * 200)}%` }} />
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-ink-mute">{f.note}</p>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[12px] leading-5 text-ink-mute">{result.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}

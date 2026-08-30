'use client';
import { useMemo, useState } from 'react';
import { calculateEmi } from '@/lib/calculators';
import { inr } from '@/lib/format';
import { LeadDialog } from '@/components/LeadDialog';

export function EmiCalculator({ products, initialPrice = 150000 }: {
  products: { id: string; label: string; price: number | null }[]; initialPrice?: number;
}) {
  const [productId, setProductId] = useState('');
  const [price, setPrice] = useState(initialPrice);
  const [down, setDown] = useState(Math.round(initialPrice * 0.2));
  const [rate, setRate] = useState(11.5);
  const [months, setMonths] = useState(36);

  const result = useMemo(
    () => calculateEmi({ principal: price, annualRatePercent: rate, months, downPayment: down }),
    [price, rate, months, down],
  );
  const interestShare = result.totalPayable > 0 ? (result.totalInterest / result.totalPayable) * 100 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="card h-max space-y-4 p-5">
        <div>
          <label className="label" htmlFor="emi-product">Pick a model (optional)</label>
          <select id="emi-product" className="field" value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p?.price) { setPrice(p.price); setDown(Math.round(p.price * 0.2)); }
            }}>
            <option value="">Enter price manually</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="emi-price">On-road price (₹)</label>
          <input id="emi-price" type="number" min={10000} step={1000} className="field" value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)} />
          <p className="hint">Ex-showroom prices exclude insurance and registration — use the on-road figure for a realistic EMI.</p>
        </div>
        <div>
          <label className="label" htmlFor="emi-down">Down payment: {inr(down)} ({price ? Math.round((down / price) * 100) : 0}%)</label>
          <input id="emi-down" type="range" min={0} max={price} step={1000} value={Math.min(down, price)}
            onChange={(e) => setDown(Number(e.target.value))} className="w-full accent-brand-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="emi-rate">Interest (% p.a.)</label>
            <input id="emi-rate" type="number" step="0.1" min={0} max={40} className="field" value={rate} onChange={(e) => setRate(Number(e.target.value) || 0)} /></div>
          <div><label className="label" htmlFor="emi-months">Tenure (months)</label>
            <select id="emi-months" className="field" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
              {[12, 18, 24, 30, 36, 48, 60].map((m) => <option key={m} value={m}>{m} months</option>)}
            </select></div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card bg-gradient-to-br from-brand-50 to-white p-6">
          <p className="text-[12.5px] font-medium text-brand-700">Your monthly EMI</p>
          <p className="mt-1 text-[40px] font-bold leading-none tracking-[-0.04em]">{inr(result.emi)}</p>
          <p className="mt-2 text-[13px] text-ink-mute">
            {inr(result.principal)} financed over {months} months at {rate}% per annum.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div><p className="text-[11.5px] text-ink-mute">Loan amount</p><p className="text-[15px] font-semibold">{inr(result.principal)}</p></div>
            <div><p className="text-[11.5px] text-ink-mute">Total interest</p><p className="text-[15px] font-semibold text-accent-dark">{inr(result.totalInterest)}</p></div>
            <div><p className="text-[11.5px] text-ink-mute">Total payable</p><p className="text-[15px] font-semibold">{inr(result.totalPayable)}</p></div>
          </div>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-white">
            <div className="bg-brand-500" style={{ width: `${100 - interestShare}%` }} />
            <div className="bg-accent" style={{ width: `${interestShare}%` }} />
          </div>
          <p className="mt-1.5 text-[11.5px] text-ink-mute">
            Interest is {interestShare.toFixed(1)}% of everything you pay back.
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-3.5">
            <h3 className="text-[14px] font-semibold">First 12 instalments</h3>
            <p className="text-[11.5px] text-ink-mute">Early EMIs are mostly interest — that is how reducing-balance loans work.</p>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-5 py-2 text-left font-semibold">Month</th><th className="px-4 py-2 text-right font-semibold">Principal</th><th className="px-4 py-2 text-right font-semibold">Interest</th><th className="px-5 py-2 text-right font-semibold">Balance</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.schedulePreview.map((r) => (
                  <tr key={r.month}>
                    <td className="px-5 py-2">{r.month}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{inr(r.principal)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-ink-mute">{inr(r.interest)}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{inr(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-[14px] font-semibold">Want an actual loan quote?</p>
            <p className="text-[12.5px] text-ink-mute">We pass your details to a finance partner. This calculator is an estimate, not an approval.</p>
          </div>
          <LeadDialog
            leadType="finance"
            productId={productId || undefined}
            label="Request finance callback"
            title="Request a finance callback"
            description="Share your contact details and a finance partner will call you with actual rates for your profile."
            source="tools/emi"
          />
        </div>
      </div>
    </div>
  );
}

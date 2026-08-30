'use client';
import { useMemo, useState } from 'react';
import { evVsPetrol } from '@/lib/calculators';
import { inr } from '@/lib/format';

export interface CalcBike { id: string; label: string; mileage: number | null; range: number | null; battery: number | null; price: number | null }

export function EvCalculator({ petrolBikes, evBikes, defaults }: {
  petrolBikes: CalcBike[]; evBikes: CalcBike[];
  defaults: { petrolPrice: number; electricityPrice: number; efficiency: number };
}) {
  const [petrolId, setPetrolId] = useState(petrolBikes.find((b) => b.mileage)?.id || petrolBikes[0]?.id || '');
  const [evId, setEvId] = useState(evBikes.find((b) => b.battery && b.range)?.id || evBikes[0]?.id || '');
  const [monthlyKm, setMonthlyKm] = useState(800);
  const [petrolPrice, setPetrolPrice] = useState(defaults.petrolPrice);
  const [unitPrice, setUnitPrice] = useState(defaults.electricityPrice);

  const petrol = petrolBikes.find((b) => b.id === petrolId);
  const ev = evBikes.find((b) => b.id === evId);

  const missing: string[] = [];
  if (!petrol?.mileage) missing.push('mileage for the petrol bike');
  if (!ev?.battery) missing.push('battery capacity for the EV');
  if (!ev?.range) missing.push('range for the EV');

  const result = useMemo(() => {
    if (!petrol?.mileage || !ev?.battery || !ev?.range) return null;
    return evVsPetrol({
      monthlyKm, petrolPrice, electricityPrice: unitPrice,
      mileageKmpl: petrol.mileage, evRangeKm: ev.range, batteryKwh: ev.battery,
      chargingEfficiencyPercent: defaults.efficiency,
      petrolPrice_vehicle: petrol.price ?? undefined, evPrice: ev.price ?? undefined,
    });
  }, [petrol, ev, monthlyKm, petrolPrice, unitPrice, defaults.efficiency]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="card h-max space-y-4 p-5">
        <div>
          <label className="label" htmlFor="ev-petrol">Petrol bike</label>
          <select id="ev-petrol" className="field" value={petrolId} onChange={(e) => setPetrolId(e.target.value)}>
            {petrolBikes.map((b) => <option key={b.id} value={b.id}>{b.label}{b.mileage ? ` · ${b.mileage} kmpl` : ' · mileage unknown'}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ev-ev">Electric model</label>
          <select id="ev-ev" className="field" value={evId} onChange={(e) => setEvId(e.target.value)}>
            {evBikes.map((b) => <option key={b.id} value={b.id}>{b.label}{b.range ? ` · ${b.range} km` : ' · range unknown'}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="km">Riding: {monthlyKm} km per month</label>
          <input id="km" type="range" min={100} max={3000} step={50} value={monthlyKm}
            onChange={(e) => setMonthlyKm(Number(e.target.value))} className="w-full accent-brand-500" />
          <div className="flex justify-between text-[11px] text-ink-mute"><span>100 km</span><span>3,000 km</span></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pp">Petrol ₹/litre</label>
            <input id="pp" type="number" step="0.5" min={50} className="field" value={petrolPrice} onChange={(e) => setPetrolPrice(Number(e.target.value) || 0)} /></div>
          <div><label className="label" htmlFor="up">Electricity ₹/unit</label>
            <input id="up" type="number" step="0.5" min={1} className="field" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value) || 0)} /></div>
        </div>
        <p className="hint">Change the fuel and tariff rates to match your city — the defaults come from site settings, not a live feed.</p>
      </div>

      <div className="space-y-4">
        {!result ? (
          <div className="card p-6">
            <p className="text-[14px] font-semibold">We cannot calculate this pair</p>
            <p className="mt-1 text-[13px] leading-6 text-ink-mute">
              Our database is missing {missing.join(' and ')}. Rather than guess a number, we leave it blank —
              please pick another model.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-[12px] text-ink-mute">Petrol running cost</p>
                <p className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{inr(result.petrol.monthly)}<span className="text-[12px] font-medium text-ink-mute">/mo</span></p>
                <p className="text-[11.5px] text-ink-mute">₹{result.petrol.perKm.toFixed(2)} per km</p>
              </div>
              <div className="card p-4">
                <p className="text-[12px] text-ink-mute">Electric running cost</p>
                <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-accent-dark">{inr(result.ev.monthly)}<span className="text-[12px] font-medium text-ink-mute">/mo</span></p>
                <p className="text-[11.5px] text-ink-mute">₹{result.ev.perKm.toFixed(2)} per km</p>
              </div>
              <div className="card border-brand-200 bg-brand-50/60 p-4">
                <p className="text-[12px] text-brand-700">You save</p>
                <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-brand-700">{inr(Math.abs(result.monthlySaving))}<span className="text-[12px] font-medium">/mo</span></p>
                <p className="text-[11.5px] text-brand-700/80">{inr(Math.abs(result.annualSaving))} a year{result.monthlySaving < 0 ? ' in favour of petrol' : ''}</p>
              </div>
            </div>

            <div className="card p-5">
              <h3 className="text-[14px] font-semibold">Does the higher EV price pay for itself?</h3>
              {result.priceDifference <= 0 ? (
                <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                  The electric option costs {inr(Math.abs(result.priceDifference))} <strong>less</strong> to buy as well as less to run — there is no upfront gap to recover.
                </p>
              ) : result.breakEvenMonths == null ? (
                <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                  The EV costs {inr(result.priceDifference)} more upfront and does not save money at these rates, so it never breaks even on cost alone.
                </p>
              ) : (
                <>
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                    The EV costs <strong>{inr(result.priceDifference)}</strong> more upfront. At {monthlyKm} km a month you recover that in{' '}
                    <strong>{result.breakEvenMonths} months</strong> ({(result.breakEvenMonths / 12).toFixed(1)} years, about {result.breakEvenKm?.toLocaleString('en-IN')} km).
                  </p>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent" style={{ width: `${Math.min(100, (60 / result.breakEvenMonths) * 100)}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-ink-mute">Bar shows progress within a 5-year ownership window.</p>
                </>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3.5"><h3 className="text-[14px] font-semibold">Five-year cost of ownership</h3></div>
              <table className="w-full text-[13px]">
                <thead className="bg-surface text-[11.5px] uppercase tracking-wide text-ink-mute">
                  <tr><th className="px-5 py-2 text-left font-semibold">Cost</th><th className="px-5 py-2 text-right font-semibold">Petrol</th><th className="px-5 py-2 text-right font-semibold">Electric</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr><td className="px-5 py-2.5 text-ink-mute">Fuel / electricity</td><td className="px-5 py-2.5 text-right tabular-nums">{inr(result.petrol.fiveYearEnergy)}</td><td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(result.ev.fiveYearEnergy)}</td></tr>
                  <tr><td className="px-5 py-2.5 text-ink-mute">Routine maintenance</td><td className="px-5 py-2.5 text-right tabular-nums">{inr(result.petrol.fiveYearMaintenance)}</td><td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(result.ev.fiveYearMaintenance)}</td></tr>
                  <tr className="bg-surface/60 font-semibold"><td className="px-5 py-2.5">Five-year total</td><td className="px-5 py-2.5 text-right tabular-nums">{inr(result.petrol.fiveYearTotal)}</td><td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(result.ev.fiveYearTotal)}</td></tr>
                </tbody>
              </table>
            </div>

            <details className="card p-5">
              <summary className="cursor-pointer text-[13.5px] font-semibold">Assumptions behind these numbers</summary>
              <ul className="mt-3 space-y-1.5 text-[12.5px] leading-5 text-ink-mute">
                {result.assumptions.map((a) => <li key={a}>• {a}</li>)}
              </ul>
            </details>
          </>
        )}
      </div>
    </div>
  );
}

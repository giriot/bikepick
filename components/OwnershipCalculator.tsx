'use client';

import { useEffect, useState } from 'react';
import { inr } from '@/lib/format';
import { ownershipCost, type OwnershipResult } from '@/lib/calculators';
import type { CalcBike } from './EvCalculator';

interface Props {
  bikes: CalcBike[];
  defaults: { petrolPrice: number; electricityPrice: number; efficiency: number };
  initialA?: string;
  initialB?: string;
}

const YRS = [3, 5, 7];

function BikePicker({ label, bikes, value, onChange }: { label: string; bikes: CalcBike[]; value: string; onChange: (id: string) => void }) {
  const petrol = bikes.filter((b) => b.fuel === 'petrol');
  const electric = bikes.filter((b) => b.fuel === 'electric');
  return (
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]"
      >
        <option value="">— pick a model —</option>
        {petrol.length > 0 && (
          <optgroup label="Petrol">
            {petrol.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </optgroup>
        )}
        {electric.length > 0 && (
          <optgroup label="Electric">
            {electric.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  );
}

function ResultCard({ bike, result, years }: { bike: CalcBike | undefined; result: OwnershipResult; years: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold leading-5">{bike?.label ?? 'No model selected'}</h3>
          <p className="text-[11.5px] text-ink-mute">
            {bike?.fuel === 'electric' ? 'Electric' : 'Petrol'} · ex-showroom {bike?.price ? inr(bike.price) : 'not recorded'}
          </p>
        </div>
        {bike && <span className="badge bg-brand-50 text-brand-700">₹{result.costPerKm ?? '—'}/km total</span>}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-surface px-2 py-2">
          <p className="text-[10.5px] uppercase tracking-wide text-ink-mute">On-road</p>
          <p className="text-[13px] font-bold">{result.onRoadPrice ? inr(result.onRoadPrice) : '—'}</p>
        </div>
        <div className="rounded-lg bg-surface px-2 py-2">
          <p className="text-[10.5px] uppercase tracking-wide text-ink-mute">Energy ₹/km</p>
          <p className="text-[13px] font-bold">{result.energyPerKm != null ? `₹${result.energyPerKm}` : '—'}</p>
        </div>
        <div className="rounded-lg bg-surface px-2 py-2">
          <p className="text-[10.5px] uppercase tracking-wide text-ink-mute">Cost / month</p>
          <p className="text-[13px] font-bold">{inr(result.costPerMonth)}</p>
        </div>
      </div>

      {result.missing.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md bg-amber-50 px-2.5 py-2 text-[11.5px] leading-4 text-amber-900 ring-1 ring-amber-100">
          {result.missing.map((m) => (
            <li key={m}>Missing {m}.</li>
          ))}
        </ul>
      )}

      <div className="mt-3 overflow-hidden rounded-lg border border-line">
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="bg-surface text-left text-ink-mute">
              <th className="px-2 py-1.5 font-semibold">Year</th>
              <th className="px-2 py-1.5 font-semibold">Energy</th>
              <th className="px-2 py-1.5 font-semibold">Insurance</th>
              <th className="px-2 py-1.5 font-semibold">Service</th>
              <th className="px-2 py-1.5 text-right font-semibold">Total so far</th>
            </tr>
          </thead>
          <tbody>
            {result.years.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="px-2 py-1.5">{y.year}</td>
                <td className="px-2 py-1.5">{y.energy ? inr(y.energy) : '—'}</td>
                <td className="px-2 py-1.5">{y.insurance ? inr(y.insurance) : 'Incl.'}</td>
                <td className="px-2 py-1.5">{inr(y.service)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{inr(y.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1.5 text-[12.5px]">
        <Row k={`${years}-year total cost`} v={inr(result.totalCost)} bold />
        <Row k="Energy" v={inr(result.totalEnergy)} />
        <Row k="Insurance renewals" v={inr(result.totalInsurance)} />
        <Row k="Service" v={inr(result.totalService)} />
        <Row k="Est. resale value" v={result.resaleValue ? inr(result.resaleValue) : '—'} />
        <div className="rounded-md bg-emerald-50 px-2.5 py-1.5 ring-1 ring-emerald-100">
          <span className="font-semibold text-emerald-900">Net cost of ownership </span>
          <span className="text-emerald-900">({years} yr − resale): </span>
          <span className="font-bold text-emerald-900">{result.netCost != null ? inr(result.netCost) : '—'}</span>
        </div>
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-ink-mute">Assumptions</summary>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-ink-mute">
          {result.assumptions.map((a) => <li key={a}>{a}</li>)}
        </ul>
      </details>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-mute">{k}</span>
      <span className={bold ? 'font-bold' : 'font-medium'}>{v}</span>
    </div>
  );
}

export function OwnershipCalculator({ bikes, defaults, initialA, initialB }: Props) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [years, setYears] = useState(5);
  const [kmPerYear, setKmPerYear] = useState(10000);
  const [petrolPrice, setPetrolPrice] = useState(defaults.petrolPrice);
  const [electricityPrice, setElectricityPrice] = useState(defaults.electricityPrice);
  const [efficiency, setEfficiency] = useState(defaults.efficiency);

  useEffect(() => {
    if (initialA && bikes.some((x) => x.id === initialA)) setA(initialA);
    if (initialB && bikes.some((x) => x.id === initialB)) setB(initialB);
  }, [initialA, initialB, bikes]);

  const bikeA = bikes.find((x) => x.id === a);
  const bikeB = bikes.find((x) => x.id === b);

  const calc = (bike: CalcBike | undefined) => {
    if (!bike) return null;
    return ownershipCost({
      price: bike.price,
      fuel: bike.fuel === 'electric' ? 'electric' : 'petrol',
      mileageKmpl: bike.mileage,
      batteryKwh: bike.battery,
      rangeKm: bike.range,
      years, kmPerYear, petrolPrice, electricityPrice, chargingEfficiencyPercent: efficiency,
    });
  };
  const resA = calc(bikeA);
  const resB = calc(bikeB);

  const saving = resA && resB && resA.netCost != null && resB.netCost != null ? resA.netCost - resB.netCost : null;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <BikePicker label="Vehicle A" bikes={bikes} value={a} onChange={setA} />
        <BikePicker label="Vehicle B (optional — compare)" bikes={bikes} value={b} onChange={setB} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Years</span>
          <div className="mt-1 flex rounded-lg border border-line bg-white p-0.5">
            {YRS.map((y) => (
              <button key={y} onClick={() => setYears(y)}
                className={`flex-1 rounded-md px-2 py-1.5 text-[12.5px] font-semibold ${years === y ? 'bg-brand-600 text-white' : 'text-ink-mute'}`}>
                {y}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Km / year</span>
          <input type="number" value={kmPerYear} min={500} step={500}
            onChange={(e) => setKmPerYear(Number(e.target.value) || 10000)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Petrol ₹/L</span>
          <input type="number" value={petrolPrice} min={50} step={0.5}
            onChange={(e) => setPetrolPrice(Number(e.target.value) || 104.5)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Electricity ₹/unit</span>
          <input type="number" value={electricityPrice} min={1} step={0.5}
            onChange={(e) => setElectricityPrice(Number(e.target.value) || 8)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]" />
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Charge efficiency %</span>
          <input type="number" value={efficiency} min={40} max={100}
            onChange={(e) => setEfficiency(Number(e.target.value) || 85)}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]" />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {resA ? <ResultCard bike={bikeA} result={resA} years={years} /> : (
          <div className="card flex h-full min-h-[200px] items-center justify-center p-6 text-center text-[13px] text-ink-mute">
            Pick a vehicle to see its {years}-year ownership cost.
          </div>
        )}
        {resB ? <ResultCard bike={bikeB} result={resB} years={years} /> : (
          <div className="card flex h-full min-h-[200px] items-center justify-center p-6 text-center text-[13px] text-ink-mute">
            Pick a second vehicle to compare side by side.
          </div>
        )}
      </div>

      {saving != null && (
        <p className="mt-4 rounded-lg bg-brand-50 px-3.5 py-2.5 text-[13px] font-semibold text-brand-800 ring-1 ring-brand-100">
          Over {years} years, {bikeA?.label} costs {saving > 0 ? inr(saving) : inr(-saving)} {saving > 0 ? 'more' : 'less'} than {bikeB?.label}
          {saving > 0 && resA && resB && resA.onRoadPrice && resB.onRoadPrice && resA.onRoadPrice < resB.onRoadPrice
            ? ' — a cheaper purchase price does not always mean cheaper ownership.' : '.'}
        </p>
      )}

      <p className="mt-3 text-[11.5px] leading-5 text-ink-mute">
        Estimates only. On-road price uses ~9% RTO + ~5% first-year insurance. Insurance renewals, service and resale use
        standard two-wheeler averages — actual figures vary with state, insurer and dealer.
      </p>
    </div>
  );
}

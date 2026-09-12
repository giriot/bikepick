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
const CUSTOM = '__custom__';

type Fuel = 'petrol' | 'electric' | 'cng';

interface BikeInfo {
  id: string;
  label: string;
  fuel: Fuel;
  price: number | null;
  mileage: number | null; // petrol: kmpl · cng: km/kg
  range: number | null;   // electric
  battery: number | null; // electric
  batteryReplacement: number | null;
  batteryWarrantyYears: number | null;
}

const toInfo = (b: CalcBike): BikeInfo => ({
  id: b.id,
  label: b.label,
  fuel: b.fuel === 'electric' ? 'electric' : b.fuel === 'hybrid' ? 'cng' : 'petrol',
  price: b.price,
  mileage: b.mileage,
  range: b.range,
  battery: b.battery,
  batteryReplacement: b.batteryReplacement,
  batteryWarrantyYears: b.batteryWarrantyYears ?? null,
});

const EMPTY_CUSTOM: BikeInfo = { id: CUSTOM, label: '', fuel: 'petrol', price: null, mileage: null, range: null, battery: null, batteryReplacement: null, batteryWarrantyYears: null };

function BikePicker({ label, bikes, value, onChange }: { label: string; bikes: CalcBike[]; value: string; onChange: (id: string) => void }) {
  const petrol = bikes.filter((b) => b.fuel === 'petrol');
  const electric = bikes.filter((b) => b.fuel === 'electric');
  const cng = bikes.filter((b) => b.fuel === 'hybrid');
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
        {cng.length > 0 && (
          <optgroup label="CNG">
            {cng.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </optgroup>
        )}
        <option value={CUSTOM}>＋ Custom vehicle (petrol / electric / CNG)…</option>
      </select>
    </label>
  );
}

function CustomForm({ value, onChange }: { value: BikeInfo; onChange: (v: BikeInfo) => void }) {
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const set = (patch: Partial<BikeInfo>) => onChange({ ...value, ...patch });
  return (
    <div className="mt-2 rounded-lg border border-brand-100 bg-brand-50/50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-800">Enter vehicle details</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="col-span-2 block">
          <span className="text-[11px] text-ink-mute">Name</span>
          <input value={value.label} placeholder="e.g. Bajaj Freedom 125 CNG"
            onChange={(e) => set({ label: e.target.value })}
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-mute">Fuel</span>
          <select value={value.fuel} onChange={(e) => set({ fuel: e.target.value as Fuel })}
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2 py-1.5 text-[13px]">
            <option value="petrol">Petrol</option>
            <option value="electric">Electric</option>
            <option value="cng">CNG</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-ink-mute">Ex-showroom price ₹</span>
          <input type="number" inputMode="numeric" placeholder="e.g. 95000"
            value={value.price ?? ''} onChange={(e) => set({ price: num(e.target.value) })}
            className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
        </label>
        {value.fuel === 'petrol' && (
          <label className="block">
            <span className="text-[11px] text-ink-mute">Mileage (kmpl)</span>
            <input type="number" inputMode="decimal" placeholder="e.g. 55"
              value={value.mileage ?? ''} onChange={(e) => set({ mileage: num(e.target.value) })}
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
          </label>
        )}
        {value.fuel === 'cng' && (
          <label className="block">
            <span className="text-[11px] text-ink-mute">CNG mileage (km/kg)</span>
            <input type="number" inputMode="decimal" placeholder="e.g. 50"
              value={value.mileage ?? ''} onChange={(e) => set({ mileage: num(e.target.value) })}
              className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
          </label>
        )}
        {value.fuel === 'electric' && (
          <>
            <label className="block">
              <span className="text-[11px] text-ink-mute">Battery (kWh)</span>
              <input type="number" inputMode="decimal" placeholder="e.g. 3.7"
                value={value.battery ?? ''} onChange={(e) => set({ battery: num(e.target.value) })}
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
            </label>
            <label className="block">
              <span className="text-[11px] text-ink-mute">Range (km)</span>
              <input type="number" inputMode="numeric" placeholder="e.g. 110"
                value={value.range ?? ''} onChange={(e) => set({ range: num(e.target.value) })}
                className="mt-0.5 w-full rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function ResultCard({ bike, result, years }: { bike: BikeInfo | undefined; result: OwnershipResult; years: number }) {
  const fuelLabel = bike?.fuel === 'electric' ? 'Electric' : bike?.fuel === 'cng' ? 'CNG' : 'Petrol';
  const approx = bike
    ? bike.fuel === 'electric'
      ? bike.range ? `range ~${bike.range} km (approx.)` : 'range not recorded'
      : bike.mileage ? `mileage ~${bike.mileage} ${bike.fuel === 'cng' ? 'km/kg' : 'kmpl'} (approx.)` : 'mileage not recorded'
    : '';
  const insuranceOff = result.insuranceRenewal === 0;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold leading-5">{bike?.label || 'No model selected'}</h3>
          <p className="text-[11.5px] text-ink-mute">
            {fuelLabel} · ex-showroom {bike?.price ? inr(bike.price) : 'not recorded'}
            {approx && <span className="text-ink-mute"> · {approx}</span>}
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
          <p className="text-[10.5px] uppercase tracking-wide text-ink-mute">{result.energyName} ₹/km</p>
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
              <th className="px-2 py-1.5 font-semibold">{result.energyName}</th>
              <th className="px-2 py-1.5 font-semibold">Insurance</th>
              <th className="px-2 py-1.5 font-semibold">Service</th>
              <th className="px-2 py-1.5 text-right font-semibold">Yearly spend</th>
              <th className="px-2 py-1.5 text-right font-semibold">Total so far</th>
            </tr>
          </thead>
          <tbody>
            {result.years.map((y) => (
              <tr key={y.year} className="border-t border-line">
                <td className="px-2 py-1.5">{y.year}</td>
                <td className="px-2 py-1.5">{y.energy ? inr(y.energy) : '—'}</td>
                <td className="px-2 py-1.5">{insuranceOff ? '—' : y.insurance ? inr(y.insurance) : 'Incl.'}</td>
                <td className="px-2 py-1.5">{inr(y.service)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{inr(y.runningTotal)}</td>
                <td className="px-2 py-1.5 text-right font-semibold">{inr(y.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 space-y-1.5 text-[12.5px]">
        <Row k={`${years}-year total cost`} v={inr(result.totalCost)} bold />
        <Row k={result.energyName} v={inr(result.totalEnergy)} />
        <Row k={insuranceOff ? 'Insurance (excluded)' : 'Insurance renewals'} v={insuranceOff ? '—' : inr(result.totalInsurance)} />
        <Row k="Service" v={inr(result.totalService)} />
        {result.batteryReplacementApplied && (
          <Row k="Battery replacement (warranty expired)" v={inr(result.batteryReplacement)} />
        )}
        <Row k="Est. resale value" v={result.resaleValue ? inr(result.resaleValue) : '—'} />
        {result.batteryReplacementApplied && (
          <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] leading-4 text-amber-900 ring-1 ring-amber-100">
            Battery warranty ends inside this period — resale value is reduced because the buyer must budget for a new pack.
          </p>
        )}
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
  const [customA, setCustomA] = useState<BikeInfo>(EMPTY_CUSTOM);
  const [customB, setCustomB] = useState<BikeInfo>(EMPTY_CUSTOM);
  const [years, setYears] = useState(5);
  const [kmPerYear, setKmPerYear] = useState(10000);
  const [includeInsurance, setIncludeInsurance] = useState(true);
  const [petrolPrice, setPetrolPrice] = useState(defaults.petrolPrice);
  const [electricityPrice, setElectricityPrice] = useState(defaults.electricityPrice);
  const [cngPrice, setCngPrice] = useState(90);
  const [efficiency, setEfficiency] = useState(defaults.efficiency);

  useEffect(() => {
    if (initialA && bikes.some((x) => x.id === initialA)) setA(initialA);
    if (initialB && bikes.some((x) => x.id === initialB)) setB(initialB);
  }, [initialA, initialB, bikes]);

  const pick = (sel: string, custom: BikeInfo): BikeInfo | undefined => {
    if (sel === CUSTOM) return custom;
    const found = bikes.find((x) => x.id === sel);
    return found ? toInfo(found) : undefined;
  };
  const bikeA = pick(a, customA);
  const bikeB = pick(b, customB);

  const fuels = [bikeA?.fuel, bikeB?.fuel].filter((f): f is Fuel => !!f);
  const noneSelected = !bikeA && !bikeB;
  const showPetrol = fuels.includes('petrol') || noneSelected;
  const showEv = fuels.includes('electric');
  const showCng = fuels.includes('cng');

  const calc = (bike: BikeInfo | undefined) => {
    if (!bike) return null;
    return ownershipCost({
      price: bike.price,
      fuel: bike.fuel,
      mileageKmpl: bike.fuel === 'petrol' ? bike.mileage : undefined,
      cngMileage: bike.fuel === 'cng' ? bike.mileage : undefined,
      batteryKwh: bike.battery,
      rangeKm: bike.range,
      years, kmPerYear, petrolPrice, electricityPrice, cngPrice,
      chargingEfficiencyPercent: efficiency,
      includeInsurance,
      batteryWarrantyYears: bike.batteryWarrantyYears,
      batteryReplacementCost: bike.batteryReplacement,
    });
  };
  const resA = calc(bikeA);
  const resB = calc(bikeB);

  const saving = resA && resB && resA.netCost != null && resB.netCost != null ? resA.netCost - resB.netCost : null;

  const inputCls = 'mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-[13.5px]';

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <BikePicker label="Vehicle A" bikes={bikes} value={a} onChange={setA} />
          {a === CUSTOM && <CustomForm value={customA} onChange={setCustomA} />}
        </div>
        <div>
          <BikePicker label="Vehicle B (optional — compare)" bikes={bikes} value={b} onChange={setB} />
          {b === CUSTOM && <CustomForm value={customB} onChange={setCustomB} />}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            className={inputCls} />
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-line bg-white px-3 py-2">
          <input type="checkbox" checked={includeInsurance}
            onChange={(e) => setIncludeInsurance(e.target.checked)} className="h-4 w-4 accent-[#C2410C]" />
          <span className="text-[13px] font-medium leading-tight">Include insurance</span>
        </label>
        {showPetrol && (
          <label className="block">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Petrol ₹/L</span>
            <input type="number" value={petrolPrice} min={50} step={0.5}
              onChange={(e) => setPetrolPrice(Number(e.target.value) || 104.5)}
              className={inputCls} />
          </label>
        )}
        {showCng && (
          <label className="block">
            <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">CNG ₹/kg</span>
            <input type="number" value={cngPrice} min={40} step={0.5}
              onChange={(e) => setCngPrice(Number(e.target.value) || 90)}
              className={inputCls} />
          </label>
        )}
        {showEv && (
          <>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Electricity ₹/unit</span>
              <input type="number" value={electricityPrice} min={1} step={0.5}
                onChange={(e) => setElectricityPrice(Number(e.target.value) || 8)}
                className={inputCls} />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-mute">Charge efficiency %</span>
              <input type="number" value={efficiency} min={40} max={100}
                onChange={(e) => setEfficiency(Number(e.target.value) || 85)}
                className={inputCls} />
            </label>
          </>
        )}
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
        Estimates only. On-road price uses ~9% RTO{includeInsurance ? ' plus first-year insurance' : ''} — insurance renewals, service
        and resale use standard two-wheeler averages. Actual figures vary with state, insurer and dealer.
      </p>
    </div>
  );
}

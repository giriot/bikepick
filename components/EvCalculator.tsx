'use client';
import { useEffect, useState } from 'react';
import { inr } from '@/lib/format';

export type FuelKey = 'petrol' | 'electric' | 'hybrid';

export interface CalcBike {
  id: string;
  label: string;
  body: string | null; // 'scooter' | 'street' | 'sport' | …
  fuel: FuelKey;
  mileage: number | null;
  range: number | null;
  battery: number | null;
  price: number | null;
  batteryReplacement: number | null; // recorded estimate for EV battery pack replacement
}

const FUEL_KEYS: FuelKey[] = ['petrol', 'electric', 'hybrid'];
const FUEL_LABEL: Record<FuelKey, string> = {
  petrol: 'Petrol',
  electric: 'Electric',
  hybrid: 'Hybrid CNG+Petrol',
};
const BODY_KEYS = [
  { key: 'all', label: 'Bikes + scooters' },
  { key: 'bike', label: 'Bikes' },
  { key: 'scooter', label: 'Scooters' },
] as const;
type BodyKey = (typeof BODY_KEYS)[number]['key'];

const isScooter = (b: CalcBike) => b.body === 'scooter';

interface SideInputs {
  monthlyKm: number;
  petrolPrice: number;
  unitPrice: number;
  efficiency: number;
  hybridPerKm: number;
}

interface SideCalc {
  perKm: number;
  servicePerYear: number;
  energyLabel: string;
  assumptions: string[];
}

/** Cost per km for one vehicle. Never invents a number — missing data means "cannot calculate". */
function calcSide(fuel: FuelKey, bike: CalcBike, i: SideInputs): SideCalc | { missing: string } {
  if (fuel === 'petrol') {
    if (!bike.mileage) return { missing: `the recorded mileage for ${bike.label}` };
    return {
      perKm: i.petrolPrice / bike.mileage,
      servicePerYear: 3500,
      energyLabel: 'Petrol fuel',
      assumptions: [`${bike.label}: petrol at ₹${i.petrolPrice}/litre with the recorded ${bike.mileage} kmpl.`],
    };
  }
  if (fuel === 'electric') {
    if (!bike.battery || !bike.range) return { missing: `the battery/range figures for ${bike.label}` };
    const eff = Math.max(0.4, Math.min(1, i.efficiency / 100));
    return {
      perKm: ((bike.battery / bike.range) * i.unitPrice) / eff,
      servicePerYear: 1500,
      energyLabel: 'Electricity',
      assumptions: [
        `${bike.label}: electricity at ₹${i.unitPrice}/unit with ${Math.round(eff * 100)}% charging efficiency.`,
        `${bike.label}: consumption derived from the recorded ${bike.battery} kWh battery over ${bike.range} km usable range.`,
      ],
    };
  }
  // Hybrid CNG+Petrol — fuel mix is personal, so the per-km spend is user-entered, never invented.
  if (!(i.hybridPerKm > 0)) return { missing: `your CNG+Petrol fuel cost per km for ${bike.label} (enter it under the model pick)` };
  return {
    perKm: i.hybridPerKm,
    servicePerYear: 3500,
    energyLabel: 'CNG+Petrol fuel',
    assumptions: [`${bike.label}: hybrid CNG+Petrol at ₹${i.hybridPerKm}/km — your entered spend, not an estimate by us.`],
  };
}

export function EvCalculator({ groups, defaults }: {
  groups: Record<FuelKey, CalcBike[]>;
  defaults: { petrolPrice: number; electricityPrice: number; efficiency: number };
}) {
  const [aFuel, setAFuel] = useState<FuelKey>('petrol');
  const [aBody, setABody] = useState<BodyKey>('all');
  const [aId, setAId] = useState('');
  const [aHybrid, setAHybrid] = useState(0);

  const [bFuel, setBFuel] = useState<FuelKey>('electric');
  const [bBody, setBBody] = useState<BodyKey>('all');
  const [bId, setBId] = useState('');
  const [bHybrid, setBHybrid] = useState(0);

  const [monthlyKm, setMonthlyKm] = useState(800);
  const [petrolPrice, setPetrolPrice] = useState(defaults.petrolPrice);
  const [unitPrice, setUnitPrice] = useState(defaults.electricityPrice);

  const [includeBattery, setIncludeBattery] = useState(false);
  const [batteryCost, setBatteryCost] = useState('');

  const filter = (list: CalcBike[], body: BodyKey) =>
    body === 'all' ? list : list.filter((b) => (body === 'scooter' ? isScooter(b) : !isScooter(b)));
  const aModels = filter(groups[aFuel], aBody);
  const bModels = filter(groups[bFuel], bBody);
  const aModel = aModels.find((m) => m.id === aId) ?? aModels[0] ?? null;
  const bModel = bModels.find((m) => m.id === bId) ?? bModels[0] ?? null;

  const evModel = aModel?.fuel === 'electric' ? aModel : bModel?.fuel === 'electric' ? bModel : null;
  // "AI can get it?" — when the selected EV has a recorded replacement estimate
  // (from our researched/AI data) it is pre-filled; the textbox + tick mark are
  // the fallback when nothing is recorded.
  useEffect(() => {
    if (evModel?.batteryReplacement) {
      setBatteryCost(String(evModel.batteryReplacement));
      setIncludeBattery(true);
    }
  }, [evModel?.id]);

  const batteryAmount = Math.max(0, Number(batteryCost) || 0);
  const batteryIncluded = includeBattery && batteryAmount > 0;

  const inputs = (hybridPerKm: number): SideInputs => ({
    monthlyKm, petrolPrice, unitPrice, efficiency: defaults.efficiency, hybridPerKm,
  });
  const ca = aModel ? calcSide(aFuel, aModel, inputs(aHybrid)) : ({ missing: 'a model for vehicle 1' } as const);
  const cb = bModel ? calcSide(bFuel, bModel, inputs(bHybrid)) : ({ missing: 'a model for vehicle 2' } as const);
  const missing = [...(('missing' in ca) ? [ca.missing] : []), ...(('missing' in cb) ? [cb.missing] : [])];
  const ready = !!aModel && !!bModel && !('missing' in ca) && !('missing' in cb);

  let A: SideCalc | null = null, B: SideCalc | null = null;
  if (ready && aModel && bModel) {
    A = ca as SideCalc; B = cb as SideCalc;
  }

  const vehicleCard = (
    which: 'A' | 'B',
    fuel: FuelKey, setFuel: (f: FuelKey) => void,
    body: BodyKey, setBody: (b: BodyKey) => void,
    id: string, setId: (v: string) => void,
    model: CalcBike | null, models: CalcBike[],
    hybrid: number, setHybrid: (n: number) => void,
  ) => (
    <div className="card space-y-3 p-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-mute">Vehicle {which === 'A' ? '1' : '2'}</p>
      <div>
        <label className="label">Fuel</label>
        <select className="field" value={fuel} onChange={(e) => setFuel(e.target.value as FuelKey)}>
          {FUEL_KEYS.map((f) => (
            <option key={f} value={f}>{FUEL_LABEL[f]}{groups[f].length === 0 ? ' (none in database yet)' : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Type</label>
        <select className="field" value={body} onChange={(e) => setBody(e.target.value as BodyKey)}>
          {BODY_KEYS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Model</label>
        {models.length > 0 ? (
          <select className="field" value={model?.id ?? ''} onChange={(e) => setId(e.target.value)}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}{m.fuel === 'electric' ? (m.range ? ` · ${m.range} km` : ' · range unknown') : m.mileage ? ` · ${m.mileage} kmpl` : ''}
              </option>
            ))}
          </select>
        ) : (
          <p className="rounded-md bg-surface px-3 py-2 text-[12px] leading-5 text-ink-mute">
            No {FUEL_LABEL[fuel]} {body === 'all' ? 'bikes or scooters' : body + 's'} in the database yet — this list
            fills up automatically as soon as they are added.
          </p>
        )}
      </div>
      {fuel === 'hybrid' && (
        <div>
          <label className="label" htmlFor={`hyb-${which}`}>CNG+Petrol cost ₹/km (your spend)</label>
          <input id={`hyb-${which}`} type="number" step="0.1" min="0" className="field" value={hybrid || ''}
            onChange={(e) => setHybrid(Number(e.target.value) || 0)} placeholder="e.g. 2.5" />
          <p className="hint">Your real fuel spend per km (fuel bill ÷ km). Hybrid mixes are personal, so we never invent this figure.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <div className="h-max space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {vehicleCard('A', aFuel, setAFuel, aBody, setABody, aId, setAId, aModel, aModels, aHybrid, setAHybrid)}
          {vehicleCard('B', bFuel, setBFuel, bBody, setBBody, bId, setBId, bModel, bModels, bHybrid, setBHybrid)}
        </div>
        <div className="card space-y-4 p-5">
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
        {(aModel?.fuel === 'electric' || bModel?.fuel === 'electric') && (
          <div className="card p-4">
            <label className="flex cursor-pointer items-start gap-2.5 text-[13px] font-semibold">
              <input type="checkbox" checked={includeBattery} onChange={(e) => setIncludeBattery(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-500" />
              <span>Include battery replacement (year ~5) in the 5-year total</span>
            </label>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink-mute">₹</span>
              <input type="number" min="0" step="500" className="field max-w-[180px]" value={batteryCost}
                onChange={(e) => setBatteryCost(e.target.value)} placeholder="e.g. 45000" aria-label="Battery replacement cost" />
              <span className="text-[11.5px] text-ink-mute">
                {evModel?.batteryReplacement
                  ? 'Pre-filled from the recorded estimate for this model — edit it to your dealer quote.'
                  : 'No recorded estimate for this model — enter the dealer quote for a battery pack replacement.'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {!ready || !A || !B || !aModel || !bModel ? (
          <div className="card p-6">
            <p className="text-[14px] font-semibold">We cannot calculate this pair yet</p>
            <p className="mt-1 text-[13px] leading-6 text-ink-mute">
              {missing.length
                ? <>Our database is missing {missing.join(' and ')}. Rather than guess a number, we leave it blank — please pick another model or fill in the field above.</>
                : 'Pick both vehicles to see the comparison.'}
            </p>
          </div>
        ) : (() => {
          const aEnergy5 = Math.round(A.perKm * monthlyKm * 12 * 5);
          const bEnergy5 = Math.round(B.perKm * monthlyKm * 12 * 5);
          const aMaint5 = A.servicePerYear * 5;
          const bMaint5 = B.servicePerYear * 5;
          const aBattery = aModel.fuel === 'electric' && batteryIncluded ? batteryAmount : 0;
          const bBattery = bModel.fuel === 'electric' && batteryIncluded ? batteryAmount : 0;
          const aTotal = aEnergy5 + aMaint5 + aBattery;
          const bTotal = bEnergy5 + bMaint5 + bBattery;
          const aMonthly = A.perKm * monthlyKm + A.servicePerYear / 12;
          const bMonthly = B.perKm * monthlyKm + B.servicePerYear / 12;
          const monthlySaving = aMonthly - bMonthly; // > 0 → vehicle 2 is cheaper
          const cheaperName = monthlySaving >= 0 ? `${FUEL_LABEL[bFuel]} (${bModel.label})` : `${FUEL_LABEL[aFuel]} (${aModel.label})`;
          const priceA = aModel.price ?? 0, priceB = bModel.price ?? 0;
          let expensive: 'A' | 'B' | null = null; let breakEvenMonths: number | null = null;
          if (priceB > priceA && bMonthly < aMonthly) { expensive = 'B'; breakEvenMonths = Math.ceil((priceB - priceA) / (aMonthly - bMonthly)); }
          else if (priceA > priceB && aMonthly < bMonthly) { expensive = 'A'; breakEvenMonths = Math.ceil((priceA - priceB) / (bMonthly - aMonthly)); }
          const expName = expensive === 'A' ? `${FUEL_LABEL[aFuel]} (${aModel.label})` : `${FUEL_LABEL[bFuel]} (${bModel.label})`;
          const expDiff = expensive === 'A' ? priceA - priceB : priceB - priceA;
          const assumptions = [
            ...A.assumptions, ...B.assumptions,
            `Maintenance assumed at ₹${A.servicePerYear.toLocaleString('en-IN')}/yr (${FUEL_LABEL[aFuel]}) and ₹${B.servicePerYear.toLocaleString('en-IN')}/yr (${FUEL_LABEL[bFuel]}).`,
            batteryIncluded
              ? `Battery replacement of ${inr(batteryAmount)} (year ~5) is included for the electric side${aBattery && bBattery ? 's' : ''}.`
              : 'Battery replacement is NOT included in the total — tick the box on the left to add it.',
            'All figures are estimates. Real costs vary with riding style, load, terrain, tariffs and service pricing.',
          ];
          return (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="card p-4">
                  <p className="text-[12px] text-ink-mute">{FUEL_LABEL[aFuel]} running cost</p>
                  <p className="mt-1 truncate text-[22px] font-bold tracking-[-0.02em]">{inr(Math.round(aMonthly))}<span className="text-[12px] font-medium text-ink-mute">/mo</span></p>
                  <p className="text-[11.5px] text-ink-mute">₹{A.perKm.toFixed(2)} per km · {aModel.label}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[12px] text-ink-mute">{FUEL_LABEL[bFuel]} running cost</p>
                  <p className="mt-1 truncate text-[22px] font-bold tracking-[-0.02em] text-accent-dark">{inr(Math.round(bMonthly))}<span className="text-[12px] font-medium text-ink-mute">/mo</span></p>
                  <p className="text-[11.5px] text-ink-mute">₹{B.perKm.toFixed(2)} per km · {bModel.label}</p>
                </div>
                <div className="card border-brand-200 bg-brand-50/60 p-4">
                  <p className="text-[12px] text-brand-700">You save</p>
                  <p className="mt-1 text-[22px] font-bold tracking-[-0.02em] text-brand-700">{inr(Math.round(Math.abs(monthlySaving)))}<span className="text-[12px] font-medium">/mo</span></p>
                  <p className="text-[11.5px] leading-4 text-brand-700/80">{monthlySaving === 0 ? 'both cost the same to run' : `in favour of ${cheaperName}`}</p>
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-[14px] font-semibold">Does the higher price pay for itself?</h3>
                {priceA === 0 || priceB === 0 ? (
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                    A recorded price is missing for one of these models, so we can only compare running cost — not the upfront gap.
                  </p>
                ) : breakEvenMonths == null ? (
                  <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                    {expensive ? (
                      <>The {expName} costs {inr(expDiff)} more upfront and does not save money at these rates, so it never breaks even on cost alone.</>
                    ) : (
                      <>Both are recorded at the same price — the running cost above is the deciding factor.</>
                    )}
                  </p>
                ) : (
                  <>
                    <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">
                      The {expName} costs <strong>{inr(expDiff)}</strong> more upfront. At {monthlyKm} km a month you recover that in{' '}
                      <strong>{breakEvenMonths} months</strong> ({(breakEvenMonths / 12).toFixed(1)} years, about {(breakEvenMonths * monthlyKm).toLocaleString('en-IN')} km).
                    </p>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent" style={{ width: `${Math.min(100, (60 / breakEvenMonths) * 100)}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-ink-mute">Bar shows progress within a 5-year ownership window.</p>
                  </>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="border-b border-line px-5 py-3.5"><h3 className="text-[14px] font-semibold">Five-year cost of ownership</h3></div>
                <table className="w-full text-[13px]">
                  <thead className="bg-surface text-[11.5px] uppercase tracking-wide text-ink-mute">
                    <tr>
                      <th className="px-5 py-2 text-left font-semibold">Cost</th>
                      <th className="px-5 py-2 text-right font-semibold">{FUEL_LABEL[aFuel]}</th>
                      <th className="px-5 py-2 text-right font-semibold">{FUEL_LABEL[bFuel]}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr><td className="px-5 py-2.5 text-ink-mute">Fuel / electricity</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{inr(aEnergy5)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(bEnergy5)}</td></tr>
                    <tr><td className="px-5 py-2.5 text-ink-mute">Routine maintenance</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{inr(aMaint5)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(bMaint5)}</td></tr>
                    <tr>
                      <td className="px-5 py-2.5 text-ink-mute">Battery replacement (year ~5)</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{aBattery ? inr(aBattery) : '—'}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{bBattery ? inr(bBattery) : '—'}</td></tr>
                    <tr className="bg-surface/60 font-semibold"><td className="px-5 py-2.5">Five-year total</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{inr(aTotal)}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-accent-dark">{inr(bTotal)}</td></tr>
                  </tbody>
                </table>
              </div>

              <details className="card p-5">
                <summary className="cursor-pointer text-[13.5px] font-semibold">Assumptions behind these numbers</summary>
                <ul className="mt-3 space-y-1.5 text-[12.5px] leading-5 text-ink-mute">
                  {assumptions.map((a, i) => <li key={i}>• {a}</li>)}
                </ul>
              </details>
            </>
          );
        })()}
      </div>
    </div>
  );
}

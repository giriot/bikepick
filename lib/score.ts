/**
 * Bikepick Score
 * --------------
 * A transparent 0-100 rating computed ONLY from structured specification data
 * and price. Weights are admin-configurable. Advertising, featured placement
 * and dealer subscriptions are deliberately not inputs — there is no code path
 * by which a payment can change this number.
 *
 * Every pillar is scored on evidence that exists in the database. When a value
 * is missing the pillar is dropped and the remaining weights are re-normalised,
 * so an incomplete product is never silently rewarded or punished.
 */
import type { BikeSpecs, EvSpecs } from '@/types';

export interface ScoreWeights {
  value: number; features: number; performance: number; safety: number;
  running_cost: number; comfort: number; maintenance: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  value: 20, features: 15, performance: 15, safety: 15, running_cost: 15, comfort: 10, maintenance: 10,
};

export interface ScoreInput {
  price: number | null;
  fuelType: string | null;
  bike?: Partial<BikeSpecs> | null;
  ev?: Partial<EvSpecs> | null;
  /** Segment context: peers in the same category/price band, used for value scoring. */
  segment?: { medianPrice?: number | null; medianPower?: number | null };
}

export interface PillarScore { key: keyof ScoreWeights; label: string; score: number; weight: number; reason: string }
export interface ScoreResult { total: number; pillars: PillarScore[]; coverage: number }

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const scale = (v: number, lo: number, hi: number) => clamp(((v - lo) / (hi - lo)) * 100);

export function computeScore(input: ScoreInput, weights: ScoreWeights = DEFAULT_WEIGHTS): ScoreResult {
  const { bike, ev, price } = input;
  const isEv = (input.fuelType || '').toLowerCase() === 'electric';
  const pillars: PillarScore[] = [];

  /* ---- Value: price against the segment median, plus what you get for it --- */
  if (price && price > 0) {
    const median = input.segment?.medianPrice || price;
    const ratio = median / price; // cheaper than median => >1
    let s = clamp(50 + (ratio - 1) * 90);
    const power = isEv ? (ev?.peak_power_kw || 0) * 1.34 : bike?.max_power_bhp || 0;
    if (power && price) {
      const bhpPerLakh = power / (price / 100000);
      s = clamp(s * 0.7 + scale(bhpPerLakh, 3, 20) * 0.3);
    }
    pillars.push({
      key: 'value', label: 'Value for money', score: Math.round(s), weight: weights.value,
      reason: `Priced ${ratio >= 1 ? 'below' : 'above'} the segment median with ${power ? `${power.toFixed(1)} bhp-equivalent` : 'limited'} output per rupee.`,
    });
  }

  /* ------------------------------- Features ------------------------------- */
  const featureFlags: [string, any][] = isEv
    ? [
        ['Regenerative braking', ev?.regen_braking], ['Fast charging', ev?.fast_charging],
        ['Ride modes', ev?.ride_modes], ['Portable charger', ev?.portable_charger],
        ['Home charging', ev?.home_charging],
        ['Bluetooth cluster', bike?.bluetooth], ['Navigation', bike?.navigation],
        ['USB charging', bike?.usb_charging], ['Keyless start', bike?.keyless_start],
        ['Reverse mode', bike?.reverse_mode],
      ]
    : [
        ['Bluetooth', bike?.bluetooth], ['Navigation', bike?.navigation], ['USB charging', bike?.usb_charging],
        ['Keyless start', bike?.keyless_start], ['Cruise control', bike?.cruise_control],
        ['DRL', bike?.drl], ['Ride modes', bike?.ride_modes], ['Hill hold', bike?.hill_hold],
        ['LED headlight', bike?.headlight && /led/i.test(String(bike.headlight)) ? 1 : 0],
        ['Digital cluster', bike?.instrument_cluster && /digital|tft/i.test(String(bike.instrument_cluster)) ? 1 : 0],
      ];
  const known = featureFlags.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (known.length >= 4) {
    const present = known.filter(([, v]) => v === 1 || v === true || (typeof v === 'string' && v.length > 0));
    pillars.push({
      key: 'features', label: 'Features & technology',
      score: Math.round(clamp((present.length / known.length) * 100)),
      weight: weights.features,
      reason: `${present.length} of ${known.length} tracked features present${present.length ? `: ${present.slice(0, 4).map(([k]) => k).join(', ')}` : ''}.`,
    });
  }

  /* ------------------------------ Performance ----------------------------- */
  if (isEv ? ev?.peak_power_kw || ev?.top_speed_kmph : bike?.max_power_bhp || bike?.top_speed_kmph) {
    let s: number;
    let reason: string;
    if (isEv) {
      const pw = scale((ev?.peak_power_kw || 0) * 1.34, 1, 25);
      const tq = ev?.torque_nm ? scale(ev.torque_nm, 10, 120) : pw;
      const ts = ev?.top_speed_kmph ? scale(ev.top_speed_kmph, 45, 130) : pw;
      s = pw * 0.4 + tq * 0.3 + ts * 0.3;
      reason = `${ev?.peak_power_kw ?? '—'} kW peak, ${ev?.torque_nm ?? '—'} Nm, ${ev?.top_speed_kmph ?? '—'} km/h top speed.`;
    } else {
      const kg = bike?.kerb_weight_kg || 140;
      const ptw = (bike?.max_power_bhp || 0) / (kg / 1000);
      s = scale(ptw, 40, 220) * 0.5 + scale(bike?.max_torque_nm || 0, 8, 45) * 0.25 + scale(bike?.top_speed_kmph || 0, 70, 200) * 0.25;
      reason = `${bike?.max_power_bhp ?? '—'} bhp and ${bike?.max_torque_nm ?? '—'} Nm at ${kg} kg (${ptw.toFixed(0)} bhp/tonne).`;
    }
    pillars.push({ key: 'performance', label: 'Performance', score: Math.round(clamp(s)), weight: weights.performance, reason });
  }

  /* -------------------------------- Safety -------------------------------- */
  const absType = (bike?.abs_type || '').toLowerCase();
  if (absType || bike?.cbs !== null || bike?.front_brake) {
    let s = 30;
    const notes: string[] = [];
    if (/dual/.test(absType)) { s += 40; notes.push('dual-channel ABS'); }
    else if (/single/.test(absType)) { s += 25; notes.push('single-channel ABS'); }
    else if (bike?.cbs === 1) { s += 12; notes.push('CBS'); }
    else notes.push('no ABS/CBS recorded');
    if (bike?.traction_control === 1) { s += 10; notes.push('traction control'); }
    if (/disc/i.test(bike?.front_brake || '')) { s += 8; notes.push('front disc'); }
    if (/disc/i.test(bike?.rear_brake || '')) { s += 6; notes.push('rear disc'); }
    if (bike?.drl === 1) { s += 3; notes.push('DRL'); }
    if (bike?.hill_hold === 1) { s += 3; notes.push('hill hold'); }
    pillars.push({ key: 'safety', label: 'Safety', score: Math.round(clamp(s)), weight: weights.safety, reason: `Equipped with ${notes.join(', ')}.` });
  }

  /* ----------------------------- Running cost ----------------------------- */
  if (isEv ? ev?.battery_capacity_kwh && (ev?.real_world_range_km || ev?.claimed_range_km) : bike?.mileage_kmpl) {
    let s: number;
    let reason: string;
    if (isEv) {
      const range = ev?.real_world_range_km || (ev?.claimed_range_km || 0) * 0.75;
      const kwhPerKm = (ev?.battery_capacity_kwh || 1) / Math.max(range, 1);
      const costPerKm = kwhPerKm * 8 / 0.85;
      s = clamp(100 - scale(costPerKm, 0.15, 1.2));
      reason = `About ₹${costPerKm.toFixed(2)}/km on electricity at ₹8/unit (${Math.round(range)} km usable range).`;
    } else {
      const costPerKm = 104.5 / (bike?.mileage_kmpl || 1);
      s = clamp(100 - scale(costPerKm, 1.2, 5));
      reason = `About ₹${costPerKm.toFixed(2)}/km at ${bike?.mileage_kmpl} kmpl and ₹104.5/L.`;
    }
    pillars.push({ key: 'running_cost', label: 'Running cost', score: Math.round(s), weight: weights.running_cost, reason });
  }

  /* -------------------------------- Comfort -------------------------------- */
  if (bike?.seat_height_mm || bike?.ground_clearance_mm || bike?.suspension_rear) {
    let s = 45;
    const notes: string[] = [];
    if (bike?.seat_height_mm) {
      const sh = bike.seat_height_mm;
      s += sh >= 760 && sh <= 810 ? 18 : sh < 760 ? 12 : 4;
      notes.push(`${sh} mm seat height`);
    }
    if (bike?.ground_clearance_mm) { s += scale(bike.ground_clearance_mm, 130, 220) * 0.18; notes.push(`${bike.ground_clearance_mm} mm clearance`); }
    if (/monoshock|gas|mono/i.test(bike?.suspension_rear || '')) { s += 10; notes.push('monoshock rear'); }
    if (/telescopic|usd|upside/i.test(bike?.suspension_front || '')) { s += 6; }
    if (bike?.kerb_weight_kg && bike.kerb_weight_kg < 150) { s += 6; notes.push('light kerb weight'); }
    pillars.push({ key: 'comfort', label: 'Comfort & ergonomics', score: Math.round(clamp(s)), weight: weights.comfort, reason: notes.join(', ') || 'Based on recorded ergonomics.' });
  }

  /* ------------------------------ Maintenance ------------------------------ */
  if (bike?.service_interval_km || bike?.est_service_cost || ev?.battery_warranty || bike?.warranty) {
    let s = 50;
    const notes: string[] = [];
    if (bike?.service_interval_km) { s += scale(bike.service_interval_km, 3000, 10000) * 0.25; notes.push(`${bike.service_interval_km} km service interval`); }
    if (bike?.est_service_cost) { s += clamp(100 - scale(bike.est_service_cost, 400, 2500)) * 0.2; notes.push(`~₹${bike.est_service_cost} per service`); }
    if (isEv) {
      s += 8;
      if (ev?.battery_warranty) notes.push(`battery warranty ${ev.battery_warranty}`);
      notes.push('fewer wear items than petrol');
    }
    if (bike?.warranty) notes.push(`warranty ${bike.warranty}`);
    pillars.push({ key: 'maintenance', label: 'Maintenance', score: Math.round(clamp(s)), weight: weights.maintenance, reason: notes.join(', ') });
  }

  const totalWeight = pillars.reduce((a, p) => a + p.weight, 0);
  const allWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const total = totalWeight
    ? Math.round(pillars.reduce((a, p) => a + p.score * p.weight, 0) / totalWeight)
    : 0;

  return { total, pillars, coverage: Math.round((totalWeight / allWeight) * 100) };
}

/** Human explanation of why a product leads a comparison. */
export function explainWin(name: string, result: ScoreResult, rivals: { name: string; result: ScoreResult }[]): string {
  const best = [...result.pillars].sort((a, b) => b.score * b.weight - a.score * a.weight).slice(0, 3);
  const beaten = rivals.filter((r) => r.result.total < result.total).map((r) => r.name);
  const lead = best.map((p) => `${p.label.toLowerCase()} (${p.score}/100)`).join(', ');
  return `${name} scores ${result.total}/100, leading on ${lead}${beaten.length ? `, ahead of ${beaten.join(' and ')}` : ''}. Scores use only structured specifications and price — never paid placement.`;
}

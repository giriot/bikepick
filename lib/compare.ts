/**
 * Comparison engine — 2 to 4 products, spec-aware winner detection.
 *
 * Each attribute declares its own "better" direction, or a custom judge for
 * qualitative fields (ABS type, brakes, suspension). Nothing is decided by
 * "highest number wins": seat height, kerb weight, price, charging time and
 * service cost are all better when lower or when inside a comfortable band.
 */
import type { BikeSpecs, EvSpecs } from '@/types';
import { inr, num, yesNo } from './format';

export type Direction = 'higher' | 'lower' | 'band' | 'custom' | 'none';

export interface CompareEntity {
  id: string;
  name: string;
  brand: string;
  slug: string;
  brandSlug: string;
  image: string | null;
  price: number | null;
  fuelType: string | null;
  score: number | null;
  bike: Partial<BikeSpecs> | null;
  ev: Partial<EvSpecs> | null;
}

export interface AttributeDef {
  key: string;
  label: string;
  group: string;
  direction: Direction;
  unit?: string;
  band?: [number, number];
  get: (e: CompareEntity) => number | string | null | undefined;
  rank?: (v: string) => number;
  format?: (v: any) => string;
  evOnly?: boolean;
  petrolOnly?: boolean;
}

const absRank = (v: string) => {
  const s = (v || '').toLowerCase();
  if (/dual/.test(s)) return 3;
  if (/single/.test(s)) return 2;
  if (/cbs/.test(s)) return 1;
  return 0;
};
const brakeRank = (v: string) => (/disc/i.test(v || '') ? (/petal|dual/i.test(v) ? 3 : 2) : /drum/i.test(v || '') ? 1 : 0);
const suspRank = (v: string) => {
  const s = (v || '').toLowerCase();
  if (/usd|upside|inverted/.test(s)) return 4;
  if (/monoshock|mono|gas/.test(s)) return 3;
  if (/telescopic/.test(s)) return 2;
  return /twin|spring/.test(s) ? 1 : 0;
};

export const ATTRIBUTES: AttributeDef[] = [
  { key: 'price', label: 'Ex-showroom price', group: 'Price', direction: 'lower', get: (e) => e.price, format: (v) => inr(v) },
  { key: 'score', label: 'Bikepick Score', group: 'Price', direction: 'higher', get: (e) => e.score, format: (v) => (v ? `${v}/100` : '—') },

  { key: 'engine_type', label: 'Engine type', group: 'Engine', direction: 'none', petrolOnly: true, get: (e) => e.bike?.engine_type },
  { key: 'engine_capacity_cc', label: 'Displacement', group: 'Engine', direction: 'higher', unit: 'cc', petrolOnly: true, get: (e) => e.bike?.engine_capacity_cc },
  { key: 'max_power_bhp', label: 'Max power', group: 'Engine', direction: 'higher', unit: 'bhp', get: (e) => e.bike?.max_power_bhp ?? (e.ev?.peak_power_kw ? Number((e.ev.peak_power_kw * 1.34).toFixed(2)) : null) },
  { key: 'max_torque_nm', label: 'Max torque', group: 'Engine', direction: 'higher', unit: 'Nm', get: (e) => e.bike?.max_torque_nm ?? e.ev?.torque_nm },
  { key: 'transmission', label: 'Transmission', group: 'Engine', direction: 'none', get: (e) => e.bike?.transmission ?? (e.ev ? 'Automatic (single speed)' : null) },
  { key: 'top_speed_kmph', label: 'Top speed', group: 'Engine', direction: 'higher', unit: 'km/h', get: (e) => e.bike?.top_speed_kmph ?? e.ev?.top_speed_kmph },
  { key: 'mileage_kmpl', label: 'Mileage (claimed)', group: 'Engine', direction: 'higher', unit: 'kmpl', petrolOnly: true, get: (e) => e.bike?.mileage_kmpl },
  { key: 'fuel_tank_l', label: 'Fuel tank', group: 'Engine', direction: 'higher', unit: 'L', petrolOnly: true, get: (e) => e.bike?.fuel_tank_l },

  { key: 'battery_capacity_kwh', label: 'Battery capacity', group: 'Battery & charging', direction: 'higher', unit: 'kWh', evOnly: true, get: (e) => e.ev?.battery_capacity_kwh },
  { key: 'battery_chemistry', label: 'Battery chemistry', group: 'Battery & charging', direction: 'none', evOnly: true, get: (e) => e.ev?.battery_chemistry },
  { key: 'claimed_range_km', label: 'Range (manufacturer claimed)', group: 'Battery & charging', direction: 'higher', unit: 'km', evOnly: true, get: (e) => e.ev?.claimed_range_km },
  { key: 'real_world_range_km', label: 'Range (Bikepick estimate)', group: 'Battery & charging', direction: 'higher', unit: 'km', evOnly: true, get: (e) => e.ev?.real_world_range_km },
  { key: 'charging_time_hours', label: 'Full charge time', group: 'Battery & charging', direction: 'lower', unit: 'hrs', evOnly: true, get: (e) => e.ev?.charging_time_hours },
  { key: 'fast_charging', label: 'Fast charging', group: 'Battery & charging', direction: 'higher', evOnly: true, get: (e) => e.ev?.fast_charging, format: yesNo },
  { key: 'battery_warranty', label: 'Battery warranty', group: 'Battery & charging', direction: 'none', evOnly: true, get: (e) => e.ev?.battery_warranty },

  { key: 'kerb_weight_kg', label: 'Kerb weight', group: 'Dimensions', direction: 'lower', unit: 'kg', get: (e) => e.bike?.kerb_weight_kg ?? e.ev?.kerb_weight_kg },
  { key: 'seat_height_mm', label: 'Seat height', group: 'Dimensions', direction: 'band', band: [760, 810], unit: 'mm', get: (e) => e.bike?.seat_height_mm },
  { key: 'ground_clearance_mm', label: 'Ground clearance', group: 'Dimensions', direction: 'higher', unit: 'mm', get: (e) => e.bike?.ground_clearance_mm },
  { key: 'wheelbase_mm', label: 'Wheelbase', group: 'Dimensions', direction: 'none', unit: 'mm', get: (e) => e.bike?.wheelbase_mm },

  { key: 'front_brake', label: 'Front brake', group: 'Brakes & safety', direction: 'custom', rank: brakeRank, get: (e) => e.bike?.front_brake },
  { key: 'rear_brake', label: 'Rear brake', group: 'Brakes & safety', direction: 'custom', rank: brakeRank, get: (e) => e.bike?.rear_brake },
  { key: 'abs_type', label: 'ABS', group: 'Brakes & safety', direction: 'custom', rank: absRank, get: (e) => e.bike?.abs_type },
  { key: 'cbs', label: 'CBS', group: 'Brakes & safety', direction: 'higher', get: (e) => e.bike?.cbs, format: yesNo },
  { key: 'traction_control', label: 'Traction control', group: 'Brakes & safety', direction: 'higher', get: (e) => e.bike?.traction_control, format: yesNo },

  { key: 'suspension_front', label: 'Front suspension', group: 'Suspension & tyres', direction: 'custom', rank: suspRank, get: (e) => e.bike?.suspension_front },
  { key: 'suspension_rear', label: 'Rear suspension', group: 'Suspension & tyres', direction: 'custom', rank: suspRank, get: (e) => e.bike?.suspension_rear },
  { key: 'front_tyre', label: 'Front tyre', group: 'Suspension & tyres', direction: 'none', get: (e) => e.bike?.front_tyre },
  { key: 'rear_tyre', label: 'Rear tyre', group: 'Suspension & tyres', direction: 'none', get: (e) => e.bike?.rear_tyre },
  { key: 'wheel_type', label: 'Wheels', group: 'Suspension & tyres', direction: 'none', get: (e) => e.bike?.wheel_type },

  { key: 'instrument_cluster', label: 'Instrument cluster', group: 'Features', direction: 'none', get: (e) => e.bike?.instrument_cluster },
  { key: 'headlight', label: 'Headlight', group: 'Features', direction: 'none', get: (e) => e.bike?.headlight },
  { key: 'bluetooth', label: 'Bluetooth', group: 'Features', direction: 'higher', get: (e) => e.bike?.bluetooth, format: yesNo },
  { key: 'navigation', label: 'Navigation', group: 'Features', direction: 'higher', get: (e) => e.bike?.navigation, format: yesNo },
  { key: 'usb_charging', label: 'USB charging', group: 'Features', direction: 'higher', get: (e) => e.bike?.usb_charging, format: yesNo },
  { key: 'ride_modes', label: 'Ride modes', group: 'Features', direction: 'none', get: (e) => e.bike?.ride_modes ?? e.ev?.ride_modes },
  { key: 'cruise_control', label: 'Cruise control', group: 'Features', direction: 'higher', get: (e) => e.bike?.cruise_control, format: yesNo },

  { key: 'warranty', label: 'Warranty', group: 'Ownership', direction: 'none', get: (e) => e.bike?.warranty ?? e.ev?.warranty },
  { key: 'service_interval_km', label: 'Service interval', group: 'Ownership', direction: 'higher', unit: 'km', get: (e) => e.bike?.service_interval_km },
  { key: 'est_service_cost', label: 'Estimated service cost', group: 'Ownership', direction: 'lower', get: (e) => e.bike?.est_service_cost, format: (v) => (v ? inr(v) : '—') },
  { key: 'running_cost', label: 'Running cost (estimate)', group: 'Ownership', direction: 'lower', get: (e) => runningCostPerKm(e), format: (v) => (v ? `₹${Number(v).toFixed(2)}/km` : '—') },
];

export function runningCostPerKm(e: CompareEntity, petrolPrice = 104.5, unitPrice = 8, efficiency = 0.85): number | null {
  if ((e.fuelType || '').toLowerCase() === 'electric') {
    const range = e.ev?.real_world_range_km || (e.ev?.claimed_range_km ? e.ev.claimed_range_km * 0.75 : null);
    if (!range || !e.ev?.battery_capacity_kwh) return null;
    return Number(((e.ev.battery_capacity_kwh / range) * (unitPrice / efficiency)).toFixed(2));
  }
  if (!e.bike?.mileage_kmpl) return null;
  return Number((petrolPrice / e.bike.mileage_kmpl).toFixed(2));
}

export interface CompareCell { entityId: string; raw: number | string | null; display: string; isBest: boolean; isWorst: boolean }
export interface CompareRow { key: string; label: string; group: string; direction: Direction; cells: CompareCell[]; hasWinner: boolean }

export function buildComparison(entities: CompareEntity[]): { groups: { group: string; rows: CompareRow[] }[]; verdict: string[] } {
  const anyEv = entities.some((e) => (e.fuelType || '').toLowerCase() === 'electric');
  const anyPetrol = entities.some((e) => (e.fuelType || '').toLowerCase() !== 'electric');
  const rows: CompareRow[] = [];

  for (const attr of ATTRIBUTES) {
    if (attr.evOnly && !anyEv) continue;
    if (attr.petrolOnly && !anyPetrol) continue;

    const raws = entities.map((e) => {
      const v = attr.get(e);
      return v === undefined ? null : v;
    });
    if (raws.every((v) => v === null || v === '')) continue;

    // Comparable numeric projection used for winner detection.
    const scores = raws.map((v) => {
      if (v === null || v === '') return null;
      if (attr.direction === 'custom' && attr.rank) return attr.rank(String(v));
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    });

    let bestIdx: number[] = [];
    let worstIdx: number[] = [];
    const valid = scores.map((s, i) => ({ s, i })).filter((x) => x.s !== null) as { s: number; i: number }[];

    if (valid.length > 1 && attr.direction !== 'none') {
      let ordered: { s: number; i: number }[];
      if (attr.direction === 'band' && attr.band) {
        const [lo, hi] = attr.band;
        const dist = valid.map((x) => ({ ...x, s: x.s >= lo && x.s <= hi ? 0 : Math.min(Math.abs(x.s - lo), Math.abs(x.s - hi)) }));
        ordered = [...dist].sort((a, b) => a.s - b.s);
      } else if (attr.direction === 'lower') {
        ordered = [...valid].sort((a, b) => a.s - b.s);
      } else {
        ordered = [...valid].sort((a, b) => b.s - a.s);
      }
      const bestVal = ordered[0].s;
      const worstVal = ordered[ordered.length - 1].s;
      if (bestVal !== worstVal) {
        bestIdx = ordered.filter((x) => x.s === bestVal).map((x) => x.i);
        worstIdx = ordered.filter((x) => x.s === worstVal).map((x) => x.i);
      }
    }

    rows.push({
      key: attr.key,
      label: attr.label,
      group: attr.group,
      direction: attr.direction,
      hasWinner: bestIdx.length > 0,
      cells: entities.map((e, i) => ({
        entityId: e.id,
        raw: raws[i],
        display: formatCell(attr, raws[i]),
        isBest: bestIdx.includes(i),
        isWorst: worstIdx.includes(i) && bestIdx.length > 0,
      })),
    });
  }

  const groupOrder = ['Price', 'Engine', 'Battery & charging', 'Dimensions', 'Brakes & safety', 'Suspension & tyres', 'Features', 'Ownership'];
  const groups = groupOrder
    .map((group) => ({ group, rows: rows.filter((r) => r.group === group) }))
    .filter((g) => g.rows.length);

  return { groups, verdict: buildVerdict(entities, rows) };
}

function formatCell(attr: AttributeDef, v: number | string | null): string {
  if (v === null || v === '') return '—';
  if (attr.format) return attr.format(v);
  if (typeof v === 'number') return num(v, attr.unit || '');
  return String(v);
}

function buildVerdict(entities: CompareEntity[], rows: CompareRow[]): string[] {
  const wins = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.hasWinner) continue;
    for (const c of r.cells) if (c.isBest) wins.set(c.entityId, [...(wins.get(c.entityId) || []), r.label]);
  }
  return entities
    .map((e) => {
      const w = wins.get(e.id) || [];
      if (!w.length) return `${e.brand} ${e.name} does not lead any measured attribute in this comparison.`;
      return `${e.brand} ${e.name} leads on ${w.length} attribute${w.length > 1 ? 's' : ''}: ${w.slice(0, 6).join(', ')}${w.length > 6 ? ` and ${w.length - 6} more` : ''}.`;
    })
    .sort((a, b) => b.length - a.length);
}

import { inr, num, yesNo } from '@/lib/format';
import { batteryTone } from '@/lib/battery-tone';

type V = { id: string; name: string; is_new: number; price: number | null; on_road_price: number | null; colours: string | null };

/** Best-effort colour name → hex, for the little swatch dot next to a colour. */
const COLOUR_MAP: [RegExp, string][] = [
  [/black/i, '#1a1a1a'], [/white/i, '#f5f5f4'], [/red|racing/i, '#dc2626'], [/blue/i, '#2563eb'],
  [/green/i, '#16a34a'], [/yellow|golden/i, '#eab308'], [/orange/i, '#f97316'], [/gold/i, '#d4a017'],
  [/brown|chocolate/i, '#7c4a1f'], [/silver|grey|gray/i, '#9ca3af'], [/teal/i, '#0d9488'],
  [/purple|violet/i, '#7c3aed'], [/pink|magenta|rose/i, '#db2777'], [/maroon|burgundy|crimson/i, '#7f1d1d'],
  [/beige|cream/i, '#d6c29a'], [/bronze|copper/i, '#b87333'], [/cyan/i, '#06b6d4'],
  [/navy|midnight/i, '#1e3a8a'], [/pearl|pewter/i, '#b8b8b8'], [/chrome/i, '#c0c0c0'],
];

function colourHex(name: string): string {
  for (const [re, hex] of COLOUR_MAP) if (re.test(name)) return hex;
  return '#cbd5e1';
}

function ColourDots({ colours }: { colours: string | null | undefined }) {
  const names = (colours || '').split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (!names.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {names.map((n) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/20" style={{ backgroundColor: colourHex(n) }} />
          <span>{n}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * Side-by-side variant table (OEM/bikewale style) — shows ONLY what differs
 * between variants (e.g. disc vs drum, LED vs halogen) plus price and colours.
 * Identical values are omitted instead of repeated, so the eye lands on the
 * differences immediately. Blank means "not recorded" → a light — (never guessed).
 */
export function VariantTable({
  variants, vSpecMap, modelSpec, isEv, priceFrom,
}: {
  variants: V[];
  vSpecMap: Record<string, any>;
  modelSpec: any;
  isEv: boolean;
  fuelLabel: string;
  priceFrom?: number | null;
}) {
  const vs = (vid: string) => vSpecMap[vid] || {};
  const cell = (v: V, k: string): any => {
    const a = vs(v.id)[k];
    if (a !== undefined && a !== null && a !== '') return a;
    return modelSpec ? modelSpec[k] : undefined;
  };

  type Row = { label: string; get: (v: V) => string | null; battery?: boolean; always?: boolean; swatch?: boolean };
  const yes = (v: V, k: string) => {
    const x = cell(v, k);
    if (x === undefined || x === null) return null;
    return yesNo(x);
  };
  const txt = (v: V, k: string) => {
    const x = cell(v, k);
    return x === undefined || x === null || x === '' ? null : String(x);
  };
  const nrm = (v: V, k: string, unit?: string) => {
    const x = cell(v, k);
    if (x === undefined || x === null) return null;
    return num(x, unit);
  };
  const power = (v: V) => {
    const p = cell(v, 'max_power_bhp');
    if (p === undefined || p === null) return null;
    const rpm = cell(v, 'max_power_rpm');
    return `${p} bhp${rpm ? ` @ ${rpm} rpm` : ''}`;
  };
  const torque = (v: V) => {
    const t = cell(v, 'max_torque_nm');
    if (t === undefined || t === null) return null;
    const rpm = cell(v, 'max_torque_rpm');
    return `${t} Nm${rpm ? ` @ ${rpm} rpm` : ''}`;
  };

  const rows: Row[] = isEv
    ? [
        { label: 'Ex-showroom price', get: (v) => (v.price != null ? inr(v.price) : priceFrom != null ? inr(priceFrom) : null), always: true },
        { label: 'Colours', get: (v) => vs(v.id).colours || v.colours || null, always: true, swatch: true },
        { label: 'Claimed range', get: (v) => nrm(v, 'claimed_range_km', 'km') },
        { label: 'Real-world range (our estimate)', get: (v) => nrm(v, 'real_world_range_km', 'km') },
        { label: 'Battery capacity', get: (v) => nrm(v, 'battery_capacity_kwh', 'kWh') },
        { label: 'Battery type', get: (v) => txt(v, 'battery_chemistry'), battery: true },
        { label: 'Motor power', get: (v) => nrm(v, 'motor_power_kw', 'kW') },
        { label: 'Motor torque', get: (v) => nrm(v, 'torque_nm', 'Nm') },
        { label: 'Top speed', get: (v) => nrm(v, 'top_speed_kmph', 'km/h') },
        { label: 'Charging time (full)', get: (v) => nrm(v, 'charging_time_hours', 'h') },
        { label: 'Fast charging', get: (v) => yes(v, 'fast_charging') },
        { label: 'Charging connector', get: (v) => txt(v, 'charging_connector') },
        { label: 'Regenerative braking', get: (v) => yes(v, 'regen_braking') },
        { label: 'Ride modes', get: (v) => txt(v, 'ride_modes') },
        { label: 'Kerb weight', get: (v) => nrm(v, 'kerb_weight_kg', 'kg') },
        { label: 'Warranty', get: (v) => txt(v, 'warranty') },
        { label: 'Battery warranty', get: (v) => txt(v, 'battery_warranty') },
      ]
    : [
        { label: 'Ex-showroom price', get: (v) => (v.price != null ? inr(v.price) : priceFrom != null ? inr(priceFrom) : null), always: true },
        { label: 'Colours', get: (v) => vs(v.id).colours || v.colours || null, always: true, swatch: true },
        { label: 'Display', get: (v) => txt(v, 'instrument_cluster') },
        { label: 'Seat', get: (v) => txt(v, 'seat_type') },
        { label: 'Engine', get: (v) => nrm(v, 'engine_capacity_cc', 'cc') },
        { label: 'Transmission', get: (v) => txt(v, 'transmission') },
        { label: 'Clutch', get: (v) => txt(v, 'clutch') },
        { label: 'Max power', get: power },
        { label: 'Max torque', get: torque },
        { label: 'Mileage (claimed)', get: (v) => nrm(v, 'mileage_kmpl', 'kmpl') },
        { label: 'Top speed', get: (v) => nrm(v, 'top_speed_kmph', 'km/h') },
        { label: 'Fuel tank', get: (v) => nrm(v, 'fuel_tank_l', 'L') },
        { label: 'Front brake', get: (v) => txt(v, 'front_brake') },
        { label: 'Rear brake', get: (v) => txt(v, 'rear_brake') },
        { label: 'ABS', get: (v) => txt(v, 'abs_type') },
        { label: 'Front suspension', get: (v) => txt(v, 'suspension_front') },
        { label: 'Rear suspension', get: (v) => txt(v, 'suspension_rear') },
        { label: 'Wheel type', get: (v) => txt(v, 'wheel_type') },
        { label: 'Front tyre', get: (v) => txt(v, 'front_tyre') },
        { label: 'Rear tyre', get: (v) => txt(v, 'rear_tyre') },
        { label: 'Kerb weight', get: (v) => nrm(v, 'kerb_weight_kg', 'kg') },
        { label: 'Bluetooth (app)', get: (v) => yes(v, 'bluetooth') },
        { label: 'DRL', get: (v) => yes(v, 'drl') },
        { label: 'Ride modes', get: (v) => txt(v, 'ride_modes') },
        { label: 'Warranty', get: (v) => txt(v, 'warranty') },
      ];

  // Only the DIFFERENCES: always-visible rows (price, colours) plus any row
  // whose values are not all identical (null counts as a distinct value).
  const visible = rows.filter((r) => {
    if (r.always) return true;
    const vals = variants.map((v) => r.get(v));
    if (vals.every((x) => x == null)) return false;
    return new Set(vals.map((x) => x ?? '__null__')).size > 1;
  });
  const onlyPriceColours = visible.every((r) => r.always);

  function renderCell(r: Row, val: string | null) {
    if (r.swatch) return <ColourDots colours={val} />;
    if (val === 'Yes') return <span className="font-semibold text-emerald-600">Yes</span>;
    if (val === 'No') return <span className="font-semibold text-rose-600">No</span>;
    if (val == null || val === '') return <span className="text-[11px] text-gray-400">—</span>;
    if (r.battery) {
      const t = batteryTone(val);
      if (t) {
        return (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {val}
            <span title={t.note} className={`cursor-help rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ring-1 ${t.cls}`}>
              {t.text}
            </span>
          </span>
        );
      }
    }
    return val;
  }

  const bd = 'border-[#c3cad4]'; // gray table borders

  return (
    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">Variant differences</h2>
        <span className="text-[11.5px] text-ink-mute">{variants.length} variants · only what changes between them is listed</span>
      </div>
      <div className={`overflow-x-auto rounded-xl border ${bd}`}>
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead>
            <tr className="bg-surface">
              <th className={`sticky left-0 z-10 min-w-[128px] border-b ${bd} bg-surface px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wide text-ink-mute`}>
                Feature
              </th>
              {variants.map((v) => (
                <th key={v.id} className={`min-w-[104px] border-b border-l ${bd} px-3 py-2`}>
                  <span className="flex items-center gap-1.5 text-[12.5px] font-bold leading-tight">
                    {v.name}
                    {v.is_new === 1 && (
                      <span className="rounded bg-amber-300 px-1 py-0.5 text-[9px] font-bold uppercase leading-none text-amber-950">New</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const vals = variants.map((v) => r.get(v));
              return (
                <tr key={r.label} className={i % 2 ? 'bg-surface/40' : 'bg-white'}>
                  <td className={`sticky left-0 z-10 min-w-[128px] border-t ${bd} bg-inherit px-3 py-1.5 text-[11.5px] font-semibold text-ink-mute`}
                    style={{ backgroundColor: i % 2 ? undefined : '#fff' }}>
                    {r.label}
                  </td>
                  {vals.map((val, j) => (
                    <td key={variants[j].id} className={`border-t border-l ${bd} px-3 py-1.5 align-top text-[12px] leading-[1.4]`}>
                      {renderCell(r, val)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-ink-mute">
        {onlyPriceColours
          ? 'These variants share the same engine, brakes and features — only price and colours change.'
          : 'Only the attributes that differ between variants are shown; everything else is identical. — = not recorded.'}
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';

type SpecRow = Record<string, any>;

const CTRL =
  'w-full rounded-lg border border-[#c3cad4] bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100';
const LAB = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-mute';

function Num({ name, label, value, unit }: { name: string; label: string; value?: any; unit?: string }) {
  return (
    <label className="block">
      <span className={LAB}>{label}{unit ? <span className="ml-1 font-normal normal-case text-ink-mute">({unit})</span> : null}</span>
      <input type="number" step="any" name={name} defaultValue={value ?? ''} className={CTRL} />
    </label>
  );
}

function Sel({ name, label, value, options }: { name: string; label: string; value?: any; options: string[] }) {
  const cur = value == null || value === '' ? '' : String(value);
  // If the (AI-filled or saved) value is not in the preset list, show it as its own
  // option — otherwise the <select> matches nothing and renders "— Not recorded —".
  const opts = cur && !options.includes(cur) ? [cur, ...options] : options;
  return (
    <label className="block">
      <span className={LAB}>{label}</span>
      <select name={name} defaultValue={cur} className={CTRL}>
        <option value="">— Not recorded —</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function Txt({ name, label, value, placeholder }: { name: string; label: string; value?: any; placeholder?: string }) {
  return (
    <label className="block">
      <span className={LAB}>{label}</span>
      <input type="text" name={name} defaultValue={value ?? ''} placeholder={placeholder} className={CTRL} />
    </label>
  );
}

function Chk({ name, label, value }: { name: string; label: string; value?: any }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-[#e2e7ee] bg-white px-3 py-2 text-[13px]">
      <input type="checkbox" name={name} defaultChecked={value === 1 || value === true} className="h-4 w-4 accent-[#F0620C]" />
      {label}
    </label>
  );
}

function Group({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="border-b border-line px-5 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-mute">{title}</h2>
        {sub && <p className="mt-0.5 text-[11.5px] text-ink-mute">{sub}</p>}
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

const ENGINE_TYPES = ['air-cooled, single-cylinder, 2-valve', 'air-cooled, single-cylinder, 4-valve', 'liquid-cooled, single-cylinder, 2-valve', 'liquid-cooled, single-cylinder, 4-valve', 'air-cooled, twin-cylinder', 'liquid-cooled, twin-cylinder', 'other'];
const TRANSMISSIONS = ['5-speed manual', '6-speed manual', '4-speed manual', 'CVT automatic', 'other'];
const CLUTCHES = ['wet single-plate', 'dry single-plate', 'centrifugal (automatic)', 'not applicable'];
const FRONT_BRAKES = ['disc, 300 mm, 2-piston caliper', 'disc, 290 mm, 2-piston caliper', 'disc, 260 mm, 1-piston caliper', 'disc, 240 mm, 1-piston caliper', 'disc, 220 mm, 1-piston caliper', 'disc, 200 mm, 1-piston caliper', 'drum'];
const REAR_BRAKES = ['disc, 240 mm, 1-piston caliper', 'disc, 230 mm, 1-piston caliper', 'disc, 200 mm, 1-piston caliper', 'drum'];
const ABS_TYPES = ['none', 'single channel', 'dual channel'];
const WHEEL_TYPES = ['alloy', 'steel', 'alloy front, steel rear', 'spoke'];
const CLUSTERS = ['analog', 'LCD', 'full digital', 'TFT colour'];
const HEADLIGHTS = ['LED', 'LED projector', 'halogen', 'halogen projector'];
const CHEMISTRIES = ['Lithium-ion', 'Lithium iron phosphate (LFP)', 'Nickel manganese cobalt (NMC)', 'other'];
const CONNECTORS = ['portable charger', '15 A wall socket', '3-pin wall socket', 'proprietary', 'other'];

export function SpecSheetForm({ productId, fuelType, initial, variantId, variantName }: {
  productId: string;
  fuelType: string;
  initial: SpecRow;
  variantId?: string;
  variantName?: string;
}) {
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const payload: Record<string, any> = {};
    for (const [k, v] of fd.entries()) payload[k] = v === 'on' ? true : v === 'off' ? false : String(v);
    // free-form extra spec fields (from the OEM page or added manually)
    const extras: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      const m = k.match(/^extras_(\d+)_label$/);
      if (m) {
        const label = String(v).trim();
        const val = String(fd.get(`extras_${m[1]}_value`) ?? '').trim();
        if (label && val) extras[label] = val;
      }
    }
    payload.extras = extras;
    if (variantId) payload.variant_id = variantId;
    try {
      const res = await fetch(`/api/admin/products/${productId}/specs`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) { setErr(json.error || 'Could not save'); setBusy(false); return; }
      setMsg(json.message || 'Spec sheet saved');
    } catch {
      setErr('Could not reach the server — try again.');
    }
    setBusy(false);
  }

  if (fuelType === 'electric') {
    return (
      <form onSubmit={save} className="space-y-5">
        <Group title="Motor & battery" sub="Motor output and the battery pack. Leave blank for anything not officially published.">
          <Num name="motor_power_kw" label="Rated motor power" unit="kW" value={initial.motor_power_kw} />
          <Num name="peak_power_kw" label="Peak motor power" unit="kW" value={initial.peak_power_kw} />
          <Num name="torque_nm" label="Motor torque" unit="Nm" value={initial.torque_nm} />
          <Num name="battery_capacity_kwh" label="Battery capacity" unit="kWh" value={initial.battery_capacity_kwh} />
          <Sel name="battery_chemistry" label="Battery chemistry" value={initial.battery_chemistry} options={CHEMISTRIES} />
          <Txt name="battery_warranty" label="Battery warranty" value={initial.battery_warranty} placeholder="e.g. 3 years / 30,000 km" />
        </Group>
        <Group title="Range & charging">
          <Num name="claimed_range_km" label="Claimed range (certified)" unit="km" value={initial.claimed_range_km} />
          <Num name="real_world_range_km" label="Real-world range" unit="km" value={initial.real_world_range_km} />
          <Txt name="range_basis" label="Range basis" value={initial.range_basis} placeholder="e.g. IDC / ARAI / WMTC" />
          <Num name="charging_time_hours" label="Full charge time (0–100%)" unit="hours" value={initial.charging_time_hours} />
          <Sel name="charging_connector" label="Charging connector" value={initial.charging_connector} options={CONNECTORS} />
          <Num name="fast_charge_time_min" label="Fast charge time" unit="min" value={initial.fast_charge_time_min} />
          <Chk name="fast_charging" label="Fast charging supported" value={initial.fast_charging} />
          <Chk name="home_charging" label="Home charging supported" value={initial.home_charging} />
          <Chk name="portable_charger" label="Portable charger included" value={initial.portable_charger} />
          <Chk name="regen_braking" label="Regenerative braking" value={initial.regen_braking} />
        </Group>
        <Group title="Performance, weight & cost">
          <Num name="top_speed_kmph" label="Top speed" unit="km/h" value={initial.top_speed_kmph} />
          <Txt name="ride_modes" label="Ride modes" value={initial.ride_modes} placeholder="e.g. City, Sport, Eco" />
          <Num name="kerb_weight_kg" label="Kerb weight" unit="kg" value={initial.kerb_weight_kg} />
          <Txt name="warranty" label="Vehicle warranty" value={initial.warranty} placeholder="e.g. 3 years / 30,000 km" />
          <Num name="running_cost_per_km" label="Indicative running cost" unit="₹/km" value={initial.running_cost_per_km} />
          <Num name="est_battery_replacement_cost" label="Est. battery replacement" unit="₹" value={initial.est_battery_replacement_cost} />
        </Group>
        <Footer msg={msg} err={err} busy={busy} variantId={variantId} variantName={variantName} />
      </form>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5">
      {variantId && (
        <p className="rounded-lg border border-line bg-surface px-4 py-2.5 text-[12px] leading-4 text-ink-mute">
          Spec for the <b>{variantName}</b> variant. Leave a field blank when it is the same as the model sheet above —
          the model page will then show the model value in this variant&apos;s column.
        </p>
      )}
      <Group title="Engine & performance" sub="Exactly as the manufacturer publishes it — leave anything unpublished blank.">
        <Sel name="engine_type" label="Engine type" value={initial.engine_type} options={ENGINE_TYPES} />
        <Num name="engine_capacity_cc" label="Displacement" unit="cc" value={initial.engine_capacity_cc} />
        <Num name="max_power_bhp" label="Max power" unit="bhp" value={initial.max_power_bhp} />
        <Num name="max_power_rpm" label="Max power at" unit="rpm" value={initial.max_power_rpm} />
        <Num name="max_torque_nm" label="Max torque" unit="Nm" value={initial.max_torque_nm} />
        <Num name="max_torque_rpm" label="Max torque at" unit="rpm" value={initial.max_torque_rpm} />
        <Num name="top_speed_kmph" label="Top speed" unit="km/h" value={initial.top_speed_kmph} />
        <Num name="mileage_kmpl" label="Mileage (claimed)" unit="km/l" value={initial.mileage_kmpl} />
        <Num name="fuel_tank_l" label="Fuel tank" unit="L" value={initial.fuel_tank_l} />
        <Sel name="transmission" label="Transmission" value={initial.transmission} options={TRANSMISSIONS} />
        <Sel name="clutch" label="Clutch" value={initial.clutch} options={CLUTCHES} />
      </Group>
      <Group title="Seat & display">
        <Txt name="seat_type" label="Seat type" value={initial.seat_type} placeholder="e.g. Split Seat / Single Seat" />
        <Sel name="instrument_cluster" label="Instrument console" value={initial.instrument_cluster} options={CLUSTERS} />
        <Sel name="headlight" label="Headlight" value={initial.headlight} options={HEADLIGHTS} />
        <Txt name="ride_modes" label="Ride modes" value={initial.ride_modes} placeholder="e.g. City, Rain, Sport" />
        <Txt name="colours" label="Colours (this variant)" value={initial.colours} placeholder="Comma-separated, e.g. Fiery Yellow, Wicked Black" />
      </Group>
      <Group title="Brakes, suspension & wheels">
        <Sel name="front_brake" label="Front brake" value={initial.front_brake} options={FRONT_BRAKES} />
        <Sel name="rear_brake" label="Rear brake" value={initial.rear_brake} options={REAR_BRAKES} />
        <Sel name="abs_type" label="ABS" value={initial.abs_type} options={ABS_TYPES} />
        <Sel name="wheel_type" label="Wheel type" value={initial.wheel_type} options={WHEEL_TYPES} />
        <Chk name="cbs" label="CBS (combined braking)" value={initial.cbs} />
        <Chk name="traction_control" label="Traction control" value={initial.traction_control} />
        <Txt name="suspension_front" label="Front suspension" value={initial.suspension_front} placeholder="e.g. Telescopic, 37 mm" />
        <Txt name="suspension_rear" label="Rear suspension" value={initial.suspension_rear} placeholder="e.g. Monoshock with Nitrox" />
        <Txt name="front_tyre" label="Front tyre" value={initial.front_tyre} placeholder="e.g. 90/90-17" />
        <Txt name="rear_tyre" label="Rear tyre" value={initial.rear_tyre} placeholder="e.g. 100/90-17" />
      </Group>
      <Group title="Dimensions & weight" sub="In millimetres and kilograms, as published.">
        <Num name="length_mm" label="Length" unit="mm" value={initial.length_mm} />
        <Num name="width_mm" label="Width" unit="mm" value={initial.width_mm} />
        <Num name="height_mm" label="Height" unit="mm" value={initial.height_mm} />
        <Num name="wheelbase_mm" label="Wheelbase" unit="mm" value={initial.wheelbase_mm} />
        <Num name="seat_height_mm" label="Seat height" unit="mm" value={initial.seat_height_mm} />
        <Num name="ground_clearance_mm" label="Ground clearance" unit="mm" value={initial.ground_clearance_mm} />
        <Num name="kerb_weight_kg" label="Kerb weight" unit="kg" value={initial.kerb_weight_kg} />
      </Group>
      <Group title="Features & technology">
        <Chk name="drl" label="Day running lights (DRL)" value={initial.drl} />
        <Chk name="bluetooth" label="Bluetooth / phone connectivity" value={initial.bluetooth} />
        <Chk name="navigation" label="In-built navigation" value={initial.navigation} />
        <Chk name="usb_charging" label="USB charging" value={initial.usb_charging} />
        <Chk name="keyless_start" label="Keyless / push-button start" value={initial.keyless_start} />
        <Chk name="cruise_control" label="Cruise control" value={initial.cruise_control} />
        <Chk name="hill_hold" label="Hill hold" value={initial.hill_hold} />
        <Chk name="reverse_mode" label="Reverse mode" value={initial.reverse_mode} />
      </Group>
      <Group title="Warranty, service & misc">
        <Txt name="warranty" label="Vehicle warranty" value={initial.warranty} placeholder="e.g. 3 years / 30,000 km" />
        <Num name="service_interval_km" label="Service interval" unit="km" value={initial.service_interval_km} />
        <Num name="est_service_cost" label="Typical service cost" unit="₹" value={initial.est_service_cost} />
        <Txt name="accessories" label="Accessories" value={initial.accessories} placeholder="e.g. Saree guard, chain guard" />
      </Group>
      <ExtraFields initial={initial} />
      <Footer msg={msg} err={err} busy={busy} variantId={variantId} variantName={variantName} />
    </form>
  );
}

/** Free-form spec fields the OEM lists that have no standard dropdown. */
function ExtraFields({ initial }: { initial: SpecRow }) {
  const parsed = (() => {
    try {
      const obj = typeof initial?.extras === 'string' ? JSON.parse(initial.extras) : (initial?.extras || {});
      if (!obj || typeof obj !== 'object') return [] as [string, string][];
      return Object.entries(obj).filter(([, v]) => v != null && String(v).trim() !== '').slice(0, 12) as [string, string][];
    } catch {
      return [] as [string, string][];
    }
  })();
  const [added, setAdded] = useState<[string, string][]>([]);
  const rows = [...parsed, ...added];

  return (
    <Group
      title="Extra spec fields (from the OEM page)"
      sub="New or unusual specs the manufacturer lists that don't have a dropdown above. The AI pull can add these automatically; you can also add them here. They appear on the model page under “Also listed by the manufacturer”. Clear both boxes to remove a row."
    >
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <input type="text" name={`extras_${i}_label`} defaultValue={r[0] || ''} placeholder="Label (e.g. Seat height)" className={CTRL} />
          <input type="text" name={`extras_${i}_value`} defaultValue={r[1] || ''} placeholder="Value exactly as the OEM states it" className={CTRL} />
        </div>
      ))}
      <button type="button" onClick={() => setAdded((a) => [...a, ['', '']])} className="btn-outline btn-sm">
        + Add field
      </button>
    </Group>
  );
}

function Footer({ msg, err, busy, variantId, variantName }: {
  msg: string; err: string; busy: boolean; variantId?: string; variantName?: string;
}) {
  return (
      <div className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
        {busy ? 'Saving…' : variantId ? `Save ${variantName || 'variant'} spec` : 'Save spec sheet'}
      </button>
      {msg && <span className="text-[13px] font-medium text-emerald-700">{msg}</span>}
      {err && <span className="text-[13px] font-medium text-rose-700">{err}</span>}
    </div>
  );
}

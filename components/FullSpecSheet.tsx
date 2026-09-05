import { num, yesNo } from '@/lib/format';

/**
 * Full specification sheet for a model — grouped, label/value, rendered from
 * the model-level spec row (bike_specs / ev_specs). Only rows with a recorded
 * value are shown; everything else is omitted rather than guessed. Figures are
 * as published by the manufacturer.
 */
type Row = { label: string; value: string | null };

function t(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  return String(v);
}
function n(v: any, unit: string): string | null {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return null;
  return num(v, unit);
}
function y(v: any): string | null {
  if (v === null || v === undefined || v === '') return null;
  return yesNo(v);
}
function power(spec: any): string | null {
  if (spec?.max_power_bhp == null) return null;
  const rpm = spec?.max_power_rpm ? ` @ ${spec.max_power_rpm} rpm` : '';
  return `${spec.max_power_bhp} bhp${rpm}`;
}
function torque(spec: any): string | null {
  if (spec?.max_torque_nm == null) return null;
  const rpm = spec?.max_torque_rpm ? ` @ ${spec.max_torque_rpm} rpm` : '';
  return `${spec.max_torque_nm} Nm${rpm}`;
}

export function FullSpecSheet({ bike, ev, isEv }: { bike: any; ev: any; isEv: boolean }) {
  const s = isEv ? ev : bike;
  if (!s) return null;

  const groups: { title: string; rows: Row[] }[] = isEv
    ? [
        {
          title: 'Motor & battery',
          rows: [
            { label: 'Motor power', value: n(s.motor_power_kw, 'kW') },
            { label: 'Peak power', value: n(s.peak_power_kw, 'kW') },
            { label: 'Motor torque', value: n(s.torque_nm, 'Nm') },
            { label: 'Battery capacity', value: n(s.battery_capacity_kwh, 'kWh') },
            { label: 'Battery type', value: t(s.battery_chemistry) },
            { label: 'Claimed range', value: n(s.claimed_range_km, 'km') },
            { label: 'Real-world range (our estimate)', value: n(s.real_world_range_km, 'km') },
          ],
        },
        {
          title: 'Charging',
          rows: [
            { label: 'Charging time (full)', value: n(s.charging_time_hours, 'h') },
            { label: 'Fast charging', value: y(s.fast_charging) },
            { label: 'Fast charge time', value: s.fast_charge_time_min ? `${s.fast_charge_time_min} min` : null },
            { label: 'Charging connector', value: t(s.charging_connector) },
            { label: 'Home charging', value: y(s.home_charging) },
            { label: 'Portable charger', value: y(s.portable_charger) },
          ],
        },
        {
          title: 'Performance & weight',
          rows: [
            { label: 'Top speed', value: n(s.top_speed_kmph, 'km/h') },
            { label: 'Kerb weight', value: n(s.kerb_weight_kg, 'kg') },
            { label: 'Regenerative braking', value: y(s.regen_braking) },
            { label: 'Ride modes', value: t(s.ride_modes) },
          ],
        },
        {
          title: 'Ownership',
          rows: [
            { label: 'Warranty', value: t(s.warranty) },
            { label: 'Battery warranty', value: t(s.battery_warranty) },
            { label: 'Running cost', value: n(s.running_cost_per_km, '₹/km') },
            { label: 'Est. battery replacement', value: s.est_battery_replacement_cost ? `₹${Number(s.est_battery_replacement_cost).toLocaleString('en-IN')}` : null },
          ],
        },
      ]
    : [
        {
          title: 'Engine & performance',
          rows: [
            { label: 'Engine', value: t(s.engine_type) },
            { label: 'Displacement', value: n(s.engine_capacity_cc, 'cc') },
            { label: 'Max power', value: power(s) },
            { label: 'Max torque', value: torque(s) },
            { label: 'Transmission', value: t(s.transmission) },
            { label: 'Clutch', value: t(s.clutch) },
            { label: 'Gearbox', value: t(s.gearbox) },
            { label: 'Top speed', value: n(s.top_speed_kmph, 'km/h') },
            { label: 'Mileage (claimed)', value: n(s.mileage_kmpl, 'kmpl') },
          ],
        },
        {
          title: 'Dimensions & weight',
          rows: [
            { label: 'Length', value: n(s.length_mm, 'mm') },
            { label: 'Width', value: n(s.width_mm, 'mm') },
            { label: 'Height', value: n(s.height_mm, 'mm') },
            { label: 'Wheelbase', value: n(s.wheelbase_mm, 'mm') },
            { label: 'Seat height', value: n(s.seat_height_mm, 'mm') },
            { label: 'Ground clearance', value: n(s.ground_clearance_mm, 'mm') },
            { label: 'Kerb weight', value: n(s.kerb_weight_kg, 'kg') },
            { label: 'Fuel tank', value: n(s.fuel_tank_l, 'L') },
          ],
        },
        {
          title: 'Brakes, tyres & suspension',
          rows: [
            { label: 'Front brake', value: t(s.front_brake) },
            { label: 'Rear brake', value: t(s.rear_brake) },
            { label: 'ABS', value: t(s.abs_type) },
            { label: 'Combined braking (CBS)', value: y(s.cbs) },
            { label: 'Front tyre', value: t(s.front_tyre) },
            { label: 'Rear tyre', value: t(s.rear_tyre) },
            { label: 'Wheel type', value: t(s.wheel_type) },
            { label: 'Front suspension', value: t(s.suspension_front) },
            { label: 'Rear suspension', value: t(s.suspension_rear) },
          ],
        },
        {
          title: 'Features',
          rows: [
            { label: 'Headlight', value: t(s.headlight) },
            { label: 'Tail light', value: t(s.tail_light) },
            { label: 'Instrument cluster', value: t(s.instrument_cluster) },
            { label: 'Seat type', value: t(s.seat_type) },
            { label: 'Ride modes', value: t(s.ride_modes) },
            { label: 'Daytime running lamps', value: y(s.drl) },
            { label: 'Bluetooth (app)', value: y(s.bluetooth) },
            { label: 'Navigation', value: y(s.navigation) },
            { label: 'USB charging', value: y(s.usb_charging) },
            { label: 'Keyless start', value: y(s.keyless_start) },
            { label: 'Cruise control', value: y(s.cruise_control) },
            { label: 'Traction control', value: y(s.traction_control) },
          ],
        },
        {
          title: 'Ownership',
          rows: [
            { label: 'Warranty', value: t(s.warranty) },
            { label: 'Service interval', value: s.service_interval_km ? `Every ${s.service_interval_km} km` : null },
            { label: 'Colours', value: t(s.colours) },
          ],
        },
      ];

  const sections = groups
    .map((g) => ({ ...g, rows: g.rows.filter((r) => r.value != null) }))
    .filter((g) => g.rows.length > 0);

  if (!sections.length) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-lg font-bold tracking-[-0.02em]">Full specifications</h2>
        <span className="text-[11.5px] text-ink-mute">figures as published by the manufacturer</span>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {sections.map((g) => (
          <div key={g.title} className="overflow-hidden rounded-xl border border-line">
            <h3 className="border-b border-line bg-surface px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">
              {g.title}
            </h3>
            <dl className="divide-y divide-line">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-4 px-4 py-2">
                  <dt className="text-[12.5px] text-ink-mute">{r.label}</dt>
                  <dd className="text-right text-[13px] font-semibold">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

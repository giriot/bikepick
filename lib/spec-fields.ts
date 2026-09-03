/** Whitelisted spec columns — the only fields the spec sheet can store.
 *  Shared by the admin spec API, the AI extraction layer and the form. */

export const BIKE_SPEC_KEYS = [
  'engine_type', 'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'transmission', 'clutch', 'gearbox', 'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l',
  'length_mm', 'width_mm', 'height_mm', 'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg',
  'front_tyre', 'rear_tyre', 'front_brake', 'rear_brake', 'abs_type', 'cbs', 'traction_control',
  'suspension_front', 'suspension_rear', 'wheel_type', 'headlight', 'tail_light', 'drl', 'instrument_cluster',
  'seat_type',
  'bluetooth', 'navigation', 'usb_charging', 'keyless_start', 'cruise_control', 'ride_modes', 'hill_hold',
  'reverse_mode', 'warranty', 'service_interval_km', 'est_service_cost', 'accessories', 'colours',
] as const;

export const EV_SPEC_KEYS = [
  'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'battery_chemistry', 'battery_warranty',
  'claimed_range_km', 'real_world_range_km', 'range_basis', 'charging_time_hours', 'fast_charging',
  'fast_charge_time_min', 'charging_connector', 'home_charging', 'portable_charger', 'top_speed_kmph',
  'regen_braking', 'ride_modes', 'kerb_weight_kg', 'warranty', 'running_cost_per_km', 'est_battery_replacement_cost',
] as const;

export const NUMERIC_BIKE: Set<string> = new Set([
  'engine_capacity_cc', 'max_power_bhp', 'max_power_rpm', 'max_torque_nm', 'max_torque_rpm',
  'top_speed_kmph', 'mileage_kmpl', 'fuel_tank_l', 'length_mm', 'width_mm', 'height_mm',
  'wheelbase_mm', 'seat_height_mm', 'ground_clearance_mm', 'kerb_weight_kg', 'service_interval_km', 'est_service_cost',
]);
export const BOOL_BIKE: Set<string> = new Set([
  'cbs', 'traction_control', 'drl', 'bluetooth', 'navigation', 'usb_charging', 'keyless_start', 'cruise_control', 'hill_hold', 'reverse_mode',
]);

export const NUMERIC_EV: Set<string> = new Set([
  'motor_power_kw', 'peak_power_kw', 'torque_nm', 'battery_capacity_kwh', 'claimed_range_km',
  'real_world_range_km', 'charging_time_hours', 'fast_charge_time_min', 'top_speed_kmph',
  'kerb_weight_kg', 'running_cost_per_km', 'est_battery_replacement_cost',
]);
export const BOOL_EV: Set<string> = new Set(['fast_charging', 'home_charging', 'portable_charger', 'regen_braking']);

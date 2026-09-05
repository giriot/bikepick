/** Column contracts for CSV import. Kept here so Admin can show a template. */
export interface ImportColumn {
  name: string;
  required?: boolean;
  type: 'string' | 'number' | 'bool' | 'enum';
  options?: string[];
  help: string;
  target?: string;
}

export interface ImportType {
  key: string;
  label: string;
  table: string;
  description: string;
  /** Columns that together identify an existing record. */
  matchOn: string[];
  columns: ImportColumn[];
}

export const IMPORT_TYPES: ImportType[] = [
  {
    key: 'products',
    label: 'Products (bikes / EVs)',
    table: 'products',
    description: 'Creates or updates models. Rows are matched on brand + model name, so re-importing an updated file never duplicates.',
    matchOn: ['brand', 'name'],
    columns: [
      { name: 'brand', required: true, type: 'string', help: 'Brand name exactly as it should appear. Created if it does not exist.' },
      { name: 'name', required: true, type: 'string', help: 'Model name, e.g. "MT-15 V2".' },
      { name: 'fuel_type', required: true, type: 'enum', options: ['petrol', 'electric'], help: 'petrol or electric.' },
      { name: 'body_type', type: 'enum', options: ['commuter', 'sport', 'street', 'cruiser', 'adventure', 'scooter'], help: 'Body style used for filtering and comparison peers.' },
      { name: 'price_min', type: 'number', help: 'Ex-showroom price in rupees. Leave blank if unknown — it will be stored as null, never guessed.' },
      { name: 'price_max', type: 'number', help: 'Top-variant price, if any.' },
      { name: 'model_year', type: 'number', help: 'Year of the model generation, e.g. 2025.' },
      { name: 'status', type: 'enum', options: ['draft', 'published'], help: 'Defaults to draft so you can review before publishing.' },
      { name: 'engine_capacity_cc', type: 'number', help: 'Petrol only. Displacement in cc.' },
      { name: 'max_power_bhp', type: 'number', help: 'Maximum power output in bhp.' },
      { name: 'max_torque_nm', type: 'number', help: 'Maximum torque in newton-metres.' },
      { name: 'mileage_kmpl', type: 'number', help: 'Manufacturer-claimed mileage in km per litre.' },
      { name: 'fuel_tank_l', type: 'number', help: 'Tank capacity in litres.' },
      { name: 'kerb_weight_kg', type: 'number', help: 'Kerb weight in kilograms, with fluids.' },
      { name: 'seat_height_mm', type: 'number', help: 'Unladen seat height in millimetres.' },
      { name: 'abs_type', type: 'string', help: 'e.g. "dual-channel", "single-channel", blank if none.' },
      { name: 'battery_capacity_kwh', type: 'number', help: 'Electric vehicles only — leave blank for petrol models.' },
      { name: 'claimed_range_km', type: 'number', help: 'Electric only, manufacturer claim.' },
      { name: 'real_world_range_km', type: 'number', help: 'Electric only. Only fill this if you have a verified figure.' },
      { name: 'motor_power_kw', type: 'number', help: 'Electric only.' },
      { name: 'top_speed_kmph', type: 'number', help: 'Manufacturer-claimed top speed in km/h.' },
      { name: 'engine_type', type: 'string', help: 'Petrol only, e.g. "Air cooled, 4-stroke, single cylinder".' },
      { name: 'max_power_rpm', type: 'number', help: 'RPM at which max power is produced.' },
      { name: 'max_torque_rpm', type: 'number', help: 'RPM at which max torque is produced.' },
      { name: 'transmission', type: 'string', help: 'e.g. Manual / Automatic.' },
      { name: 'clutch', type: 'string', help: 'e.g. "Multiplate wet type".' },
      { name: 'gearbox', type: 'string', help: 'e.g. "5-Speed".' },
      { name: 'length_mm', type: 'number', help: 'Overall length in mm.' },
      { name: 'width_mm', type: 'number', help: 'Overall width in mm.' },
      { name: 'height_mm', type: 'number', help: 'Overall height in mm.' },
      { name: 'wheelbase_mm', type: 'number', help: 'Wheelbase in mm.' },
      { name: 'ground_clearance_mm', type: 'number', help: 'Ground clearance in mm.' },
      { name: 'front_tyre', type: 'string', help: 'e.g. "80/100-18".' },
      { name: 'rear_tyre', type: 'string', help: 'e.g. "80/100-18".' },
      { name: 'front_brake', type: 'string', help: 'e.g. Drum / Disc.' },
      { name: 'rear_brake', type: 'string', help: 'e.g. Drum / Disc.' },
      { name: 'suspension_front', type: 'string', help: 'Front suspension.' },
      { name: 'suspension_rear', type: 'string', help: 'Rear suspension.' },
      { name: 'wheel_type', type: 'string', help: 'e.g. Alloy / Spoke.' },
      { name: 'headlight', type: 'string', help: 'e.g. LED / Halogen.' },
      { name: 'tail_light', type: 'string', help: 'e.g. LED / Bulb.' },
      { name: 'instrument_cluster', type: 'string', help: 'e.g. Digital / Semi-digital / Analogue.' },
      { name: 'seat_type', type: 'string', help: 'e.g. Single / Split.' },
      { name: 'ride_modes', type: 'string', help: 'Comma-separated ride modes, e.g. "Eco, Power".' },
      { name: 'warranty', type: 'string', help: 'Manufacturer warranty, e.g. "5 Years".' },
      { name: 'colours', type: 'string', help: 'Comma-separated colour names — also used by AI image generation.' },
      { name: 'cbs', type: 'bool', help: '1 if combined braking system is fitted.' },
      { name: 'traction_control', type: 'bool', help: '1 if traction control is fitted.' },
      { name: 'drl', type: 'bool', help: '1 if daytime running lamps are fitted.' },
      { name: 'bluetooth', type: 'bool', help: '1 if Bluetooth/app connectivity is fitted.' },
      { name: 'navigation', type: 'bool', help: '1 if turn-by-turn navigation is fitted.' },
      { name: 'usb_charging', type: 'bool', help: '1 if a USB/mobile charging port is fitted.' },
      { name: 'keyless_start', type: 'bool', help: '1 if keyless ignition is fitted.' },
      { name: 'cruise_control', type: 'bool', help: '1 if cruise control is fitted.' },
      { name: 'hill_hold', type: 'bool', help: '1 if hill-hold assist is fitted.' },
      { name: 'reverse_mode', type: 'bool', help: '1 if a reverse assist/mode is fitted.' },
      { name: 'peak_power_kw', type: 'number', help: 'Electric only — peak motor power in kW.' },
      { name: 'torque_nm', type: 'number', help: 'Electric only — motor torque in Nm.' },
      { name: 'battery_chemistry', type: 'string', help: 'Electric only, e.g. "Li-ion".' },
      { name: 'battery_warranty', type: 'string', help: 'Electric only, e.g. "3 Years / 60,000 km".' },
      { name: 'charging_time_hours', type: 'number', help: 'Electric only — full charge time in hours (0-80% or full).' },
      { name: 'charging_connector', type: 'string', help: 'Electric only, e.g. "Type 2" / "IEC 60320".' },
      { name: 'fast_charging', type: 'bool', help: 'Electric only — 1 if fast charging is supported.' },
      { name: 'home_charging', type: 'bool', help: 'Electric only — 1 if home charging is supported.' },
      { name: 'portable_charger', type: 'bool', help: 'Electric only — 1 if a portable charger is supplied.' },
      { name: 'regen_braking', type: 'bool', help: 'Electric only — 1 if regenerative braking is fitted.' },
      { name: 'source_name', required: true, type: 'string', help: 'Where these figures come from. Stored against every field for traceability.' },
    ],
  },
  {
    key: 'prices',
    label: 'Prices',
    table: 'price_history',
    description: 'Appends price points and refreshes each model\u2019s current price. Price-drop alerts are evaluated after import.',
    matchOn: ['brand', 'name', 'city'],
    columns: [
      { name: 'brand', required: true, type: 'string', help: 'Brand name exactly as it should appear on the site.' },
      { name: 'name', required: true, type: 'string', help: 'Model name, matched against existing records.' },
      { name: 'price', required: true, type: 'number', help: 'Price in rupees, digits only or with commas.' },
      { name: 'price_type', type: 'enum', options: ['ex_showroom', 'on_road'], help: 'Defaults to ex_showroom.' },
      { name: 'city', type: 'string', help: 'City the price applies to, if relevant.' },
      { name: 'source_name', required: true, type: 'string', help: 'Where this price came from, for traceability.' },
    ],
  },
  {
    key: 'dealers',
    label: 'Dealers',
    table: 'dealer_profiles',
    description: 'Bulk-loads dealerships. Imported dealers start as pending and still need verification.',
    matchOn: ['business_name', 'city'],
    columns: [
      { name: 'business_name', required: true, type: 'string', help: 'Registered trading name of the dealership.' },
      { name: 'dealer_name', type: 'string', help: 'Name of the person buyers should ask for.' },
      { name: 'phone', required: true, type: 'string', help: 'Ten-digit mobile number used to contact the dealer.' },
      { name: 'email', type: 'string', help: 'Email address for lead notifications.' },
      { name: 'address', type: 'string', help: 'Street address.' },
      { name: 'city', required: true, type: 'string', help: 'City the dealership operates in — used for local search.' },
      { name: 'state', type: 'string', help: 'State name, e.g. Tamil Nadu.' },
      { name: 'pincode', type: 'string', help: 'Six-digit postal code of the dealership.' },
      { name: 'gstin', type: 'string', help: 'Fifteen-character GSTIN, if you have it on record.' },
    ],
  },
  {
    key: 'service_centres',
    label: 'Service centres',
    table: 'service_centres',
    description: 'Workshop directory rows.',
    matchOn: ['name', 'city'],
    columns: [
      { name: 'name', required: true, type: 'string', help: 'Name of the workshop or service centre.' },
      { name: 'brand', type: 'string', help: 'Brand this centre is authorised for, if applicable.' },
      { name: 'phone', type: 'string', help: 'Public contact number for this centre.' },
      { name: 'address', type: 'string', help: 'Full street address as it should be shown to buyers.' },
      { name: 'city', required: true, type: 'string', help: 'City the centre is located in.' },
      { name: 'state', type: 'string', help: 'State.' },
      { name: 'pincode', type: 'string', help: 'Six-digit postal code of the address.' },
      { name: 'services', type: 'string', help: 'Comma-separated list of services.' },
    ],
  },
];

export function getImportType(key: string) {
  return IMPORT_TYPES.find((t) => t.key === key);
}

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

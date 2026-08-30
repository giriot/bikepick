export type Role = 'admin' | 'moderator' | 'verifier' | 'dealer' | 'user';

export interface AppUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  role: Role;
  city: string | null;
  is_premium: boolean;
  phone_verified: boolean;
}

export type ProductStatus = 'draft' | 'published' | 'unpublished' | 'archived' | 'scheduled';

export interface Brand {
  id: string; name: string; slug: string; logo_url: string | null;
  logo_license_status: string; official_website: string | null; active: number;
}

export interface Category {
  id: string; name: string; slug: string; kind: string; spec_schema: string; active: number;
}

export interface Product {
  id: string;
  brand_id: string;
  category_id: string;
  name: string;
  slug: string;
  normalized_key: string;
  description: string | null;
  generation: string | null;
  model_year: number | null;
  body_type: string | null;
  fuel_type: string | null;
  status: ProductStatus;
  verification_status: string;
  is_demo: number;
  featured: number;
  price_min: number | null;
  price_max: number | null;
  score: number | null;
  score_breakdown: string | null;
  popularity: number;
  view_count: number;
  pros: string | null;
  cons: string | null;
  best_for: string | null;
  who_should_buy: string | null;
  who_should_avoid: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithBrand extends Product {
  brand_name: string;
  brand_slug: string;
  category_slug: string;
  image_url: string | null;
  alt_text: string | null;
}

export interface BikeSpecs {
  product_id: string;
  engine_type: string | null; engine_capacity_cc: number | null;
  max_power_bhp: number | null; max_power_rpm: number | null;
  max_torque_nm: number | null; max_torque_rpm: number | null;
  transmission: string | null; clutch: string | null; gearbox: string | null;
  top_speed_kmph: number | null; mileage_kmpl: number | null; fuel_tank_l: number | null;
  length_mm: number | null; width_mm: number | null; height_mm: number | null;
  wheelbase_mm: number | null; seat_height_mm: number | null;
  ground_clearance_mm: number | null; kerb_weight_kg: number | null;
  front_tyre: string | null; rear_tyre: string | null;
  front_brake: string | null; rear_brake: string | null;
  abs_type: string | null; cbs: number | null; traction_control: number | null;
  suspension_front: string | null; suspension_rear: string | null; wheel_type: string | null;
  headlight: string | null; tail_light: string | null; drl: number | null;
  instrument_cluster: string | null; bluetooth: number | null; navigation: number | null;
  usb_charging: number | null; keyless_start: number | null; cruise_control: number | null;
  ride_modes: string | null; hill_hold: number | null; reverse_mode: number | null;
  warranty: string | null; service_interval_km: number | null; est_service_cost: number | null;
  accessories: string | null; colours: string | null;
}

export interface EvSpecs {
  product_id: string;
  motor_power_kw: number | null; peak_power_kw: number | null; torque_nm: number | null;
  battery_capacity_kwh: number | null; battery_chemistry: string | null; battery_warranty: string | null;
  claimed_range_km: number | null; real_world_range_km: number | null; range_basis: string | null;
  charging_time_hours: number | null; fast_charging: number | null; fast_charge_time_min: number | null;
  charging_connector: string | null; home_charging: number | null; portable_charger: number | null;
  top_speed_kmph: number | null; regen_braking: number | null; ride_modes: string | null;
  battery_ip_rating: string | null; motor_ip_rating: string | null; kerb_weight_kg: number | null;
  warranty: string | null; running_cost_per_km: number | null; est_battery_replacement_cost: number | null;
}

export type UsedBikeStatus =
  | 'draft' | 'submitted' | 'verification_required' | 'under_review'
  | 'approved' | 'rejected' | 'needs_more_information' | 'suspended' | 'sold';

export type DealerStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type OfferStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'expired';
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'lost';

export interface ApiOk<T = unknown> { ok: true; data: T; message?: string }
export interface ApiErr { ok: false; error: string; fields?: Record<string, string> }
export type ApiResponse<T = unknown> = ApiOk<T> | ApiErr;

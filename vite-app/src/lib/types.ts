// ─── Shared domain types (mirror the Supabase schema) ───────────────────────

export type Role = 'user' | 'dealer' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  logo_path: string | null;
  is_active: boolean;
  created_at: string;
}

export type FuelType = 'petrol' | 'electric' | 'cng_petrol' | 'diesel';
export type ModelStatus = 'live' | 'upcoming' | 'outdated' | 'discontinued';

export interface BikeModel {
  id: string;
  brand_id: string;
  brand_name?: string;
  brand_slug?: string;
  name: string;
  slug: string;
  fuel_type: FuelType;
  body_type: string | null;
  price_start: number | null;
  price_end: number | null;
  mileage_kmpl: number | null;
  top_speed_kmph: number | null;
  power_ps: number | null;
  torque_nm: number | null;
  engine_cc: number | null;
  battery_kwh: number | null;
  range_km: number | null;
  charging_time: string | null;
  abs_enabled: boolean | null;
  status: ModelStatus;
  launch_date: string | null;
  is_featured: boolean;
  popularity: number | null;
  overview: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image_path: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  rating_avg?: number | null;
  review_count?: number;
}

export type VariantAvailability = 'available' | 'on_order' | 'discontinued';

export interface BikeVariant {
  id: string;
  bike_model_id: string;
  name: string;
  slug: string;
  price: number | null;
  on_road_price: number | null;
  availability: VariantAvailability;
  description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface BikeColour {
  id: string;
  bike_model_id: string;
  name: string;
  hex_code: string | null;
  image_path: string | null;
  sort_order: number;
}

export type ImageRole = 'main' | 'gallery' | 'front' | 'side' | 'rear' | 'dashboard' | 'engine' | 'feature';
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface BikeImage {
  id: string;
  bike_model_id: string;
  variant_id: string | null;
  colour_id: string | null;
  bucket: string;
  storage_path: string;
  original_path: string;
  processed_path: string | null;
  thumb_path: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  image_role: ImageRole;
  sort_order: number;
  is_primary: boolean;
  processing_status: ProcessingStatus;
  created_at: string;
}

export interface SpecGroup {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
}

export type SpecDataType = 'text' | 'number' | 'boolean' | 'select';
export type ScoreKey = 'performance' | 'mileage' | 'safety' | 'features' | 'comfort' | 'value' | 'price' | 'ev_range' | null;

export interface SpecDefinition {
  id: string;
  group_id: string;
  group_name?: string;
  name: string;
  slug: string | null;
  unit: string | null;
  data_type: SpecDataType;
  options: string[] | null;
  is_compare: boolean;
  score_key: ScoreKey;
  sort_order: number;
  is_active: boolean;
}

export interface BikeSpec {
  id: string;
  bike_model_id: string;
  variant_id: string | null;
  specification_id: string;
  spec_name?: string;
  spec_unit?: string | null;
  spec_group?: string | null;
  spec_score_key?: ScoreKey;
  data_type?: SpecDataType;
  value_text: string | null;
  value_numeric: number | null;
  value_boolean: boolean | null;
  sort_order: number;
}

export interface BikeFeature {
  id: string;
  bike_model_id: string;
  variant_id: string | null;
  name: string;
  included: boolean;
  sort_order: number;
}

export interface BikePro {
  id: string;
  bike_model_id: string;
  text: string;
  sort_order: number;
}

export interface BikeCon {
  id: string;
  bike_model_id: string;
  text: string;
  sort_order: number;
}

export type DealerStatus = 'waiting' | 'approved' | 'rejected' | 'suspended';

export interface DealerProfile {
  id: string;
  user_id: string;
  dealer_name: string;
  business_name: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  gst_number: string | null;
  brands: string[];
  website: string | null;
  status: DealerStatus;
  reject_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocType = 'rc' | 'insurance' | 'identity' | 'business_proof' | 'gst' | 'service' | 'other';

export interface DealerDocument {
  id: string;
  dealer_id: string;
  doc_type: DocType;
  label: string | null;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  is_verified: boolean;
  created_at: string;
}

export type OfferStatus = 'waiting' | 'approved' | 'rejected';

export interface DealerOffer {
  id: string;
  dealer_id: string;
  dealer_name?: string | null;
  dealer_city?: string | null;
  dealer_state?: string | null;
  bike_model_id: string;
  bike_name?: string | null;
  brand_name?: string | null;
  bike_slug?: string | null;
  brand_slug?: string | null;
  variant_id: string | null;
  variant_name?: string | null;
  location_city: string | null;
  location_state: string | null;
  ex_showroom_price: number | null;
  on_road_price: number | null;
  discount_amount: number | null;
  exchange_bonus: number | null;
  finance_offer: string | null;
  insurance_offer: string | null;
  accessories: string | null;
  final_offer_price: number | null;
  contact_phone: string | null;
  valid_until: string | null;
  status: OfferStatus;
  reject_reason: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UsedStatus = 'draft' | 'submitted' | 'waiting_approval' | 'approved' | 'rejected' | 'changes_required' | 'sold';
export type ConditionGrade = 'excellent' | 'good' | 'fair' | 'needs_repair';

export interface UsedBike {
  id: string;
  user_id: string;
  seller_name?: string | null;
  dealer_id: string | null;
  dealer_name?: string | null;
  brand_id: string | null;
  brand_name?: string | null;
  model_name: string;
  variant_name: string | null;
  year: number | null;
  price: number;
  km_driven: number | null;
  fuel_type: FuelType | null;
  city: string | null;
  state: string | null;
  area: string | null;
  condition_grade: ConditionGrade | null;
  owner_count: number | null;
  registration_number: string | null;
  has_insurance: boolean;
  service_history: boolean;
  accident_history: boolean;
  description: string | null;
  status: UsedStatus;
  is_verified_listing: boolean;
  reject_reason: string | null;
  approved_at: string | null;
  image_count?: number;
  primary_image_url?: string | null;
  doc_count?: number;
  created_at: string;
  updated_at: string;
}

export interface UsedBikeImage {
  id: string;
  used_bike_id: string;
  user_id: string;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

export interface UsedBikeDocument {
  id: string;
  used_bike_id: string;
  user_id: string;
  doc_type: DocType;
  label: string | null;
  bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  is_verified: boolean;
  created_at: string;
}

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface Review {
  id: string;
  bike_model_id: string;
  user_id: string;
  user_name?: string | null;
  title: string | null;
  rating: number;
  mileage_rating: number | null;
  comfort_rating: number | null;
  performance_rating: number | null;
  maintenance_rating: number | null;
  pros: string | null;
  cons: string | null;
  comment: string | null;
  status: ReviewStatus;
  reject_reason: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface Enquiry {
  id: string;
  type: 'contact_seller' | 'dealer_offer' | 'callback' | 'general';
  bike_model_id: string | null;
  bike_label?: string | null;
  used_bike_id: string | null;
  used_bike_label?: string | null;
  dealer_offer_id: string | null;
  to_user_id: string | null;
  to_dealer_id: string | null;
  from_user_id: string | null;
  from_name: string;
  from_phone: string;
  from_email: string | null;
  message: string | null;
  status: 'new' | 'contacted' | 'closed';
  created_at: string;
}

export type ReportReason = 'fake_listing' | 'fraud' | 'wrong_information' | 'duplicate' | 'wrong_price' | 'sold' | 'other';

export interface Report {
  id: string;
  item_type: 'used_bike' | 'dealer_offer' | 'dealer' | 'bike' | 'review' | 'other';
  item_id: string;
  item_label?: string | null;
  user_id: string | null;
  reporter_name?: string | null;
  reason: ReportReason;
  details: string | null;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body: string;
  image_path: string | null;
  category: 'guide' | 'news' | 'tips' | 'faq';
  is_published: boolean;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SiteSettings {
  [key: string]: any;
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  admin_email?: string | null;
  action: string;
  record_type: string;
  record_id: string | null;
  previous_data: any | null;
  new_data: any | null;
  meta: any | null;
  created_at: string;
}

export interface ScoreWeights {
  performance: number;
  mileage: number;
  safety: number;
  features: number;
  comfort: number;
  value: number;
  price: number;
  ev_range: number;
}

export interface SearchResult {
  brands: Brand[];
  models: BikeModel[];
  variants: {
    id: string;
    name: string;
    bike_model_id: string;
    model_name: string;
    brand_name: string;
    brand_slug: string;
    model_slug: string;
  }[];
  used: UsedBike[];
  dealers: DealerProfile[];
}

export interface FavoritesData {
  bikes: string[];
  used: string[];
  comparisons: string[];
}

export interface SeoPage {
  id: string;
  slug: string;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  body: string;
  updated_at: string;
}

export type EnquiryType = 'contact_seller' | 'dealer_offer' | 'callback' | 'general';
export type ReportStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

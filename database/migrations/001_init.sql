-- ===========================================================================
-- Bikepick.IN — initial schema (portable: PostgreSQL / Supabase + SQLite)
-- Conventions:
--   ids            TEXT (application generated, uuid-like)
--   timestamps     TEXT ISO-8601 UTC (created_at / updated_at / deleted_at)
--   booleans       INTEGER 0/1
--   soft deletion  deleted_at IS NULL means "live"
-- ===========================================================================

/* --------------------------------- IAM ---------------------------------- */
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  full_name TEXT,
  password_hash TEXT,
  role_id TEXT REFERENCES roles(id),
  role TEXT NOT NULL DEFAULT 'user',
  city TEXT,
  state TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  premium_until TEXT,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  ip TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  destination TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_dest ON otp_codes(destination, purpose);

/* ------------------------------ taxonomy -------------------------------- */
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'vehicle',
  spec_schema TEXT NOT NULL DEFAULT 'bike_specs',
  icon TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  logo_source TEXT,
  logo_license_status TEXT NOT NULL DEFAULT 'not_provided',
  official_website TEXT,
  country TEXT,
  about TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(active);

/* ------------------------------- products -------------------------------- */
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  normalized_key TEXT NOT NULL,
  description TEXT,
  generation TEXT,
  model_year INTEGER,
  body_type TEXT,
  fuel_type TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  is_demo INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  price_min REAL,
  price_max REAL,
  score REAL,
  score_breakdown TEXT,
  popularity INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  pros TEXT,
  cons TEXT,
  best_for TEXT,
  who_should_buy TEXT,
  who_should_avoid TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_brand_slug ON products(brand_id, slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_normkey ON products(normalized_key);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, status);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price_min);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  variant_code TEXT,
  model_year INTEGER,
  price REAL,
  on_road_price REAL,
  status TEXT NOT NULL DEFAULT 'active',
  is_base INTEGER NOT NULL DEFAULT 0,
  colours TEXT,
  highlights TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);

-- Immutable historical snapshots per model year / generation.
CREATE TABLE IF NOT EXISTS product_versions (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  model_year INTEGER NOT NULL,
  generation TEXT,
  snapshot TEXT NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pversions_product ON product_versions(product_id, model_year);

/* --------------------------- category spec tables ------------------------ */
CREATE TABLE IF NOT EXISTS bike_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  engine_type TEXT,
  engine_capacity_cc REAL,
  max_power_bhp REAL,
  max_power_rpm INTEGER,
  max_torque_nm REAL,
  max_torque_rpm INTEGER,
  transmission TEXT,
  clutch TEXT,
  gearbox TEXT,
  top_speed_kmph REAL,
  mileage_kmpl REAL,
  fuel_tank_l REAL,
  length_mm REAL,
  width_mm REAL,
  height_mm REAL,
  wheelbase_mm REAL,
  seat_height_mm REAL,
  ground_clearance_mm REAL,
  kerb_weight_kg REAL,
  front_tyre TEXT,
  rear_tyre TEXT,
  front_brake TEXT,
  rear_brake TEXT,
  abs_type TEXT,
  cbs INTEGER,
  traction_control INTEGER,
  suspension_front TEXT,
  suspension_rear TEXT,
  wheel_type TEXT,
  headlight TEXT,
  tail_light TEXT,
  drl INTEGER,
  instrument_cluster TEXT,
  bluetooth INTEGER,
  navigation INTEGER,
  usb_charging INTEGER,
  keyless_start INTEGER,
  cruise_control INTEGER,
  ride_modes TEXT,
  hill_hold INTEGER,
  reverse_mode INTEGER,
  warranty TEXT,
  service_interval_km INTEGER,
  est_service_cost REAL,
  accessories TEXT,
  colours TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bikespecs_product ON bike_specs(product_id);

CREATE TABLE IF NOT EXISTS ev_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  motor_power_kw REAL,
  peak_power_kw REAL,
  torque_nm REAL,
  battery_capacity_kwh REAL,
  battery_chemistry TEXT,
  battery_warranty TEXT,
  claimed_range_km REAL,
  real_world_range_km REAL,
  range_basis TEXT,
  charging_time_hours REAL,
  fast_charging INTEGER,
  fast_charge_time_min INTEGER,
  charging_connector TEXT,
  home_charging INTEGER,
  portable_charger INTEGER,
  top_speed_kmph REAL,
  regen_braking INTEGER,
  ride_modes TEXT,
  battery_ip_rating TEXT,
  motor_ip_rating TEXT,
  kerb_weight_kg REAL,
  warranty TEXT,
  running_cost_per_km REAL,
  est_battery_replacement_cost REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evspecs_product ON ev_specs(product_id);

-- Future verticals: schema present, UI switched on from Admin > Categories.
CREATE TABLE IF NOT EXISTS mobile_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  display_size_in REAL, display_type TEXT, refresh_rate_hz INTEGER,
  processor TEXT, ram_gb INTEGER, storage_gb INTEGER,
  rear_camera_mp REAL, front_camera_mp REAL, battery_mah INTEGER,
  charging_w INTEGER, has_5g INTEGER, os TEXT, weight_g REAL, warranty TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS electronics_specs (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  subtype TEXT, key_specs TEXT, power_w REAL, energy_rating TEXT,
  warranty TEXT, weight_kg REAL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

/* --------------------------- images and sources -------------------------- */
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  source_url TEXT,
  source_name TEXT,
  license_status TEXT NOT NULL DEFAULT 'unknown',
  alt_text TEXT,
  width INTEGER,
  height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_pimages_product ON product_images(product_id, approved);

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'manual',
  category_id TEXT REFERENCES categories(id),
  endpoint TEXT,
  auth_env_key TEXT,
  priority INTEGER NOT NULL DEFAULT 50,
  trust_level TEXT NOT NULL DEFAULT 'approved_secondary',
  schedule_cron TEXT,
  status TEXT NOT NULL DEFAULT 'disabled',
  last_success_at TEXT,
  last_failure_at TEXT,
  last_error TEXT,
  products_updated INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS product_sources (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  data_source_id TEXT REFERENCES data_sources(id),
  source_name TEXT NOT NULL,
  source_url TEXT,
  field_scope TEXT,
  confidence REAL,
  extracted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_psources_product ON product_sources(product_id);

CREATE TABLE IF NOT EXISTS data_import_jobs (
  id TEXT PRIMARY KEY,
  data_source_id TEXT REFERENCES data_sources(id),
  job_type TEXT NOT NULL DEFAULT 'csv',
  filename TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_valid INTEGER NOT NULL DEFAULT 0,
  rows_invalid INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_duplicate INTEGER NOT NULL DEFAULT 0,
  report TEXT,
  started_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_change_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_type TEXT NOT NULL DEFAULT 'update',
  data_source_id TEXT REFERENCES data_sources(id),
  source_name TEXT,
  source_url TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by TEXT REFERENCES users(id),
  decided_at TEXT,
  decision_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changelog_status ON data_change_logs(status, created_at);

/* --------------------------------- pricing ------------------------------- */
CREATE TABLE IF NOT EXISTS product_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  city TEXT NOT NULL DEFAULT 'India',
  price_type TEXT NOT NULL DEFAULT 'ex_showroom',
  price REAL NOT NULL,
  insurance REAL,
  registration REAL,
  currency TEXT NOT NULL DEFAULT 'INR',
  retailer TEXT,
  data_source_id TEXT REFERENCES data_sources(id),
  source_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  effective_from TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pprices_product ON product_prices(product_id, city);

CREATE TABLE IF NOT EXISTS price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  city TEXT NOT NULL DEFAULT 'India',
  price REAL NOT NULL,
  price_type TEXT NOT NULL DEFAULT 'ex_showroom',
  retailer TEXT,
  source_name TEXT,
  source_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_phistory_product ON price_history(product_id, recorded_at);

CREATE TABLE IF NOT EXISTS price_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  city TEXT,
  target_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked_at TEXT,
  triggered_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_palerts_status ON price_alerts(status);

/* --------------------------------- dealers ------------------------------- */
CREATE TABLE IF NOT EXISTS dealer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  business_name TEXT NOT NULL,
  dealer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT,
  latitude REAL,
  longitude REAL,
  brands TEXT,
  about TEXT,
  showroom_images TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_at TEXT,
  verified_by TEXT REFERENCES users(id),
  plan_id TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  rating REAL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dealers_status ON dealer_profiles(status, city);

CREATE TABLE IF NOT EXISTS dealer_documents (
  id TEXT PRIMARY KEY,
  dealer_id TEXT NOT NULL REFERENCES dealer_profiles(id),
  doc_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dealer_offers (
  id TEXT PRIMARY KEY,
  dealer_id TEXT NOT NULL REFERENCES dealer_profiles(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  city TEXT NOT NULL,
  ex_showroom REAL,
  on_road REAL,
  insurance REAL,
  registration REAL,
  discount REAL,
  exchange_bonus REAL,
  finance_offer TEXT,
  accessories_offer TEXT,
  offer_text TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  featured INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_offers_status ON dealer_offers(status, end_date);
CREATE INDEX IF NOT EXISTS idx_offers_product ON dealer_offers(product_id, city);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  price REAL NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  lead_limit INTEGER NOT NULL DEFAULT 10,
  offer_limit INTEGER NOT NULL DEFAULT 3,
  featured_placement INTEGER NOT NULL DEFAULT 0,
  features TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  dealer_id TEXT REFERENCES dealer_profiles(id),
  user_id TEXT REFERENCES users(id),
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  leads_used INTEGER NOT NULL DEFAULT 0,
  payment_id TEXT,
  auto_renew INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

/* ---------------------------- used bike market --------------------------- */
CREATE TABLE IF NOT EXISTS used_bikes (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL REFERENCES users(id),
  dealer_id TEXT REFERENCES dealer_profiles(id),
  seller_type TEXT NOT NULL DEFAULT 'individual',
  product_id TEXT REFERENCES products(id),
  brand_id TEXT REFERENCES brands(id),
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  variant_name TEXT,
  slug TEXT NOT NULL UNIQUE,
  manufacture_year INTEGER NOT NULL,
  registration_year INTEGER,
  km_driven INTEGER NOT NULL,
  owners INTEGER NOT NULL DEFAULT 1,
  fuel_type TEXT NOT NULL DEFAULT 'petrol',
  city TEXT NOT NULL,
  state TEXT,
  pincode TEXT,
  latitude REAL,
  longitude REAL,
  asking_price REAL NOT NULL,
  estimated_price_min REAL,
  estimated_price_max REAL,
  price_verdict TEXT,
  condition_grade TEXT NOT NULL DEFAULT 'good',
  insurance_status TEXT,
  insurance_valid_till TEXT,
  rc_available TEXT,
  loan_status TEXT,
  service_history TEXT,
  accident_history TEXT,
  tyre_condition TEXT,
  battery_condition TEXT,
  abs_equipped INTEGER,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  rejection_reason TEXT,
  info_request TEXT,
  trust_score INTEGER NOT NULL DEFAULT 0,
  trust_band TEXT NOT NULL DEFAULT 'needs_verification',
  trust_breakdown TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  featured_until TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  submitted_at TEXT,
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id),
  sold_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_used_status ON used_bikes(status, city);
CREATE INDEX IF NOT EXISTS idx_used_price ON used_bikes(asking_price);
CREATE INDEX IF NOT EXISTS idx_used_seller ON used_bikes(seller_id);

CREATE TABLE IF NOT EXISTS used_bike_images (
  id TEXT PRIMARY KEY,
  used_bike_id TEXT NOT NULL REFERENCES used_bikes(id),
  angle TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  rejected_reason TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usedimg_bike ON used_bike_images(used_bike_id);

CREATE TABLE IF NOT EXISTS used_bike_documents (
  id TEXT PRIMARY KEY,
  used_bike_id TEXT NOT NULL REFERENCES used_bikes(id),
  doc_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  private INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_records (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  check_type TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'not_checked',
  method TEXT,
  evidence_note TEXT,
  performed_by TEXT REFERENCES users(id),
  performed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verif_entity ON verification_records(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  used_bike_id TEXT REFERENCES used_bikes(id),
  requested_by TEXT REFERENCES users(id),
  inspector_id TEXT REFERENCES users(id),
  city TEXT,
  preferred_date TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  report TEXT,
  fee REAL,
  payment_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS used_bike_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  brand_id TEXT REFERENCES brands(id),
  model_query TEXT,
  city TEXT,
  budget_min REAL,
  budget_max REAL,
  max_km INTEGER,
  min_year INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  last_notified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

/* --------------------------- engagement & content ------------------------ */
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  variant_name TEXT,
  rating REAL NOT NULL,
  title TEXT,
  pros TEXT,
  cons TEXT,
  body TEXT,
  ownership_months INTEGER,
  km_driven INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  moderated_by TEXT REFERENCES users(id),
  moderated_at TEXT,
  rejection_reason TEXT,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);

CREATE TABLE IF NOT EXISTS comparisons (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  category_id TEXT REFERENCES categories(id),
  product_ids TEXT NOT NULL,
  title TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT REFERENCES products(id),
  used_bike_id TEXT REFERENCES used_bikes(id),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_products(user_id);

CREATE TABLE IF NOT EXISTS saved_comparisons (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_ids TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  lead_type TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  product_id TEXT REFERENCES products(id),
  variant_id TEXT REFERENCES product_variants(id),
  used_bike_id TEXT REFERENCES used_bikes(id),
  dealer_id TEXT REFERENCES dealer_profiles(id),
  offer_id TEXT REFERENCES dealer_offers(id),
  city TEXT,
  source TEXT,
  campaign TEXT,
  message TEXT,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  dealer_note TEXT,
  value_estimate REAL,
  contacted_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_dealer ON leads(dealer_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type, created_at);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'buying_guide',
  author_id TEXT REFERENCES users(id),
  author_name TEXT,
  cover_image TEXT,
  reading_minutes INTEGER,
  published INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(published, published_at);

CREATE TABLE IF NOT EXISTS seo_metadata (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  path TEXT,
  title TEXT,
  description TEXT,
  canonical TEXT,
  og_image TEXT,
  keywords TEXT,
  robots TEXT NOT NULL DEFAULT 'index,follow',
  structured_data TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seo_entity ON seo_metadata(entity_type, entity_id);

/* ------------------------------ monetisation ----------------------------- */
CREATE TABLE IF NOT EXISTS affiliate_links (
  id TEXT PRIMARY KEY,
  retailer TEXT NOT NULL,
  product_id TEXT REFERENCES products(id),
  title TEXT NOT NULL,
  accessory_type TEXT,
  normal_url TEXT,
  affiliate_url TEXT NOT NULL,
  price REAL,
  commission_percent REAL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY,
  affiliate_link_id TEXT NOT NULL REFERENCES affiliate_links(id),
  product_id TEXT REFERENCES products(id),
  user_id TEXT REFERENCES users(id),
  retailer TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_slots (
  id TEXT PRIMARY KEY,
  slot_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  page_type TEXT NOT NULL,
  position TEXT NOT NULL,
  ad_unit_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  show_desktop INTEGER NOT NULL DEFAULT 1,
  show_mobile INTEGER NOT NULL DEFAULT 1,
  frequency INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_order_id TEXT,
  provider_payment_id TEXT,
  user_id TEXT REFERENCES users(id),
  dealer_id TEXT REFERENCES dealer_profiles(id),
  purpose TEXT NOT NULL,
  reference_id TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created',
  failure_reason TEXT,
  receipt TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at);

CREATE TABLE IF NOT EXISTS revenue_events (
  id TEXT PRIMARY KEY,
  stream TEXT NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  reference_type TEXT,
  reference_id TEXT,
  dealer_id TEXT REFERENCES dealer_profiles(id),
  user_id TEXT REFERENCES users(id),
  note TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revenue_time ON revenue_events(occurred_at, stream);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  channel TEXT NOT NULL DEFAULT 'in_app',
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read_at);

/* ------------------------------- operations ------------------------------ */
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  value_type TEXT NOT NULL DEFAULT 'string',
  group_name TEXT NOT NULL DEFAULT 'general',
  label TEXT,
  help_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  detail TEXT,
  ip TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_id TEXT REFERENCES users(id),
  session_key TEXT,
  path TEXT,
  meta TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type, created_at);

CREATE TABLE IF NOT EXISTS service_centres (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand_id TEXT REFERENCES brands(id),
  dealer_id TEXT REFERENCES dealer_profiles(id),
  phone TEXT,
  address TEXT,
  city TEXT NOT NULL,
  state TEXT,
  pincode TEXT,
  services TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id TEXT PRIMARY KEY,
  bucket_key TEXT NOT NULL UNIQUE,
  hits INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

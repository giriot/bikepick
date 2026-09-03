-- ═══════════════════════════════════════════════════════════════════════════
-- CompareBike — 0001_schema.sql
-- All tables, foreign keys, checks and indexes.
-- Run first, before 0002 (functions/triggers) and 0003 (RLS).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Profiles (1:1 with auth.users) ────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  phone       text,
  role        text not null default 'user' check (role in ('user', 'dealer', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_role on public.profiles (role);

-- user_roles: audit trail of role grants (source of truth is profiles.role)
create table if not exists public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('user', 'dealer', 'admin')),
  granted_by  uuid references public.profiles (id),
  granted_at  timestamptz not null default now()
);
create index if not exists idx_user_roles_user on public.user_roles (user_id);

-- auto-create a profile row when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Brands ─────────────────────────────────────────────────────────────────
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  tagline     text,
  description text,
  logo_path   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint brands_name_unique unique (lower(name))
);
create index if not exists idx_brands_active on public.brands (is_active);

-- ─── Bike catalogue ─────────────────────────────────────────────────────────
create table if not exists public.bike_models (
  id              uuid primary key default gen_random_uuid(),
  brand_id        uuid not null references public.brands (id) on delete restrict,
  name            text not null,
  slug            text not null,
  fuel_type       text not null check (fuel_type in ('petrol', 'electric', 'cng_petrol', 'diesel')),
  body_type       text,
  price_start     numeric,
  price_end       numeric,
  engine_cc       numeric,
  power_ps        numeric,
  torque_nm       numeric,
  mileage_kmpl    numeric,
  top_speed_kmph  numeric,
  battery_kwh     numeric,
  range_km        numeric,
  charging_time   text,
  abs_enabled     boolean not null default false,
  overview        text,
  popularity      numeric,
  status          text not null default 'live' check (status in ('live', 'upcoming', 'outdated', 'discontinued')),
  launch_date     date,
  is_featured     boolean not null default false,
  is_published    boolean not null default false,
  seo_title       text,
  seo_description text,
  canonical_url   text,
  og_image_path   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (brand_id, slug)
);
create index if not exists idx_models_brand on public.bike_models (brand_id);
create index if not exists idx_models_status on public.bike_models (status);
create index if not exists idx_models_fuel on public.bike_models (fuel_type);
create index if not exists idx_models_published on public.bike_models (is_published) where is_published;
create index if not exists idx_models_name_trgm on public.bike_models using gin (to_tsvector('english', name));

create table if not exists public.bike_variants (
  id             uuid primary key default gen_random_uuid(),
  bike_model_id  uuid not null references public.bike_models (id) on delete cascade,
  name           text not null,
  price          numeric,
  on_road_price  numeric,
  availability   text not null default 'available' check (availability in ('available', 'on_order', 'discontinued')),
  is_default     boolean not null default false,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_variants_model on public.bike_variants (bike_model_id);

create table if not exists public.bike_colours (
  id            uuid primary key default gen_random_uuid(),
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  name          text not null,
  hex_code      text,
  image_path    text,
  bucket        text not null default 'bike-images',
  sort_order    int not null default 0
);
create index if not exists idx_colours_model on public.bike_colours (bike_model_id);

create table if not exists public.bike_images (
  id                uuid primary key default gen_random_uuid(),
  bike_model_id     uuid not null references public.bike_models (id) on delete cascade,
  storage_path      text not null,
  original_path     text not null,
  processed_path    text,
  bucket            text not null default 'bike-images',
  role              text not null default 'gallery' check (role in ('main', 'gallery', 'front', 'side', 'rear', 'dashboard', 'engine', 'feature')),
  is_primary        boolean not null default false,
  sort_order        int not null default 0,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  created_at        timestamptz not null default now()
);
create index if not exists idx_bike_images_model on public.bike_images (bike_model_id);

-- ─── Dynamic specification system ───────────────────────────────────────────
create table if not exists public.specification_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.specifications (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.specification_groups (id) on delete restrict,
  name       text not null,
  unit       text,
  data_type  text not null default 'text' check (data_type in ('text', 'number', 'boolean', 'select')),
  is_compare boolean not null default true,
  score_key  text check (score_key in ('performance', 'mileage', 'safety', 'features', 'comfort', 'value', 'price', 'ev_range') or score_key is null),
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, lower(name))
);
create index if not exists idx_specs_group on public.specifications (group_id);

-- per-bike values; variant_id null = value for the whole model
create table if not exists public.bike_specifications (
  id              uuid primary key default gen_random_uuid(),
  bike_model_id   uuid not null references public.bike_models (id) on delete cascade,
  variant_id      uuid references public.bike_variants (id) on delete cascade,
  specification_id uuid not null references public.specifications (id) on delete cascade,
  value_text      text,
  value_numeric   numeric,
  value_boolean   boolean,
  created_at      timestamptz not null default now(),
  unique (bike_model_id, variant_id, specification_id)
);
create index if not exists idx_bike_specs_model on public.bike_specifications (bike_model_id);
create index if not exists idx_bike_specs_spec on public.bike_specifications (specification_id);

create table if not exists public.bike_features (
  id            uuid primary key default gen_random_uuid(),
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  variant_id    uuid references public.bike_variants (id) on delete cascade,
  name          text not null,
  included      boolean not null default true,
  sort_order    int not null default 0
);
create index if not exists idx_features_model on public.bike_features (bike_model_id);

create table if not exists public.bike_pros (
  id            uuid primary key default gen_random_uuid(),
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  text          text not null,
  sort_order    int not null default 0
);
create table if not exists public.bike_cons (
  id            uuid primary key default gen_random_uuid(),
  bike_model_id uuid not null references public.bike_models (id) on delete cascade,
  text          text not null,
  sort_order    int not null default 0
);

-- ─── Dealers ────────────────────────────────────────────────────────────────
create table if not exists public.dealer_profiles (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references public.profiles (id) on delete cascade,
  dealer_name    text not null,
  business_name  text,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  area           text,
  city           text,
  state          text,
  pincode        text,
  gst_number     text,
  website        text,
  brands         text[],
  status         text not null default 'waiting' check (status in ('waiting', 'approved', 'rejected', 'suspended')),
  reject_reason  text,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_dealers_status on public.dealer_profiles (status);

create table if not exists public.dealer_documents (
  id          uuid primary key default gen_random_uuid(),
  dealer_id   uuid not null references public.dealer_profiles (id) on delete cascade,
  doc_type    text not null check (doc_type in ('rc', 'insurance', 'identity', 'business_proof', 'gst', 'service', 'other')),
  label       text,
  bucket      text not null default 'private-documents',
  storage_path text not null,
  mime_type   text,
  file_size   bigint,
  is_verified boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_dealer_docs_dealer on public.dealer_documents (dealer_id);

create table if not exists public.dealer_offers (
  id                uuid primary key default gen_random_uuid(),
  dealer_id         uuid not null references public.dealer_profiles (id) on delete cascade,
  bike_model_id     uuid not null references public.bike_models (id) on delete cascade,
  variant_id        uuid references public.bike_variants (id) on delete set null,
  ex_showroom_price numeric,
  on_road_price     numeric,
  discount_amount   numeric,
  exchange_bonus    numeric,
  final_offer_price numeric,
  finance_offer     text,
  insurance_offer   text,
  accessories       text,
  location_city     text,
  location_state    text,
  contact_phone     text,
  valid_until       date,
  status            text not null default 'waiting' check (status in ('waiting', 'approved', 'rejected')),
  reject_reason     text,
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_offers_dealer on public.dealer_offers (dealer_id);
create index if not exists idx_offers_model on public.dealer_offers (bike_model_id);
create index if not exists idx_offers_status on public.dealer_offers (status);

-- ─── Used bikes ─────────────────────────────────────────────────────────────
create table if not exists public.used_bikes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  dealer_id           uuid references public.dealer_profiles (id) on delete set null,
  brand_id            uuid references public.brands (id) on delete set null,
  model_name          text not null,
  variant_name        text,
  year                int check (year between 1950 and 2100),
  price               numeric not null check (price >= 0),
  km_driven           bigint check (km_driven >= 0 or km_driven is null),
  fuel_type           text check (fuel_type in ('petrol', 'electric', 'cng_petrol', 'diesel') or fuel_type is null),
  city                text,
  state               text,
  area                text,
  condition_grade     text check (condition_grade in ('excellent', 'good', 'fair', 'needs_repair') or condition_grade is null),
  owner_count         int check (owner_count >= 1 or owner_count is null),
  registration_number text,
  has_insurance       boolean not null default false,
  service_history     boolean not null default false,
  accident_history    boolean not null default false,
  description         text,
  status              text not null default 'draft' check (status in ('draft', 'submitted', 'waiting_approval', 'approved', 'rejected', 'changes_required', 'sold')),
  is_verified_listing boolean not null default false,
  reject_reason       text,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_used_status on public.used_bikes (status);
create index if not exists idx_used_user on public.used_bikes (user_id);
create index if not exists idx_used_price on public.used_bikes (price);
create index if not exists idx_used_city on public.used_bikes (city);

create table if not exists public.used_bike_images (
  id           uuid primary key default gen_random_uuid(),
  used_bike_id uuid not null references public.used_bikes (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  bucket       text not null default 'used-bike-images',
  storage_path text not null,
  mime_type    text,
  file_size    bigint,
  width        int,
  height       int,
  sort_order   int not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_used_imgs_bike on public.used_bike_images (used_bike_id);

create table if not exists public.used_bike_documents (
  id           uuid primary key default gen_random_uuid(),
  used_bike_id uuid not null references public.used_bikes (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  doc_type     text not null check (doc_type in ('rc', 'insurance', 'identity', 'business_proof', 'gst', 'service', 'other')),
  label        text,
  bucket       text not null default 'private-documents',
  storage_path text not null,
  mime_type    text,
  file_size    bigint,
  is_verified  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_used_docs_bike on public.used_bike_documents (used_bike_id);

-- ─── Engagement ─────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  bike_model_id    uuid not null references public.bike_models (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  title            text,
  rating           int not null check (rating between 1 and 5),
  mileage_rating   int check (mileage_rating between 1 and 5 or mileage_rating is null),
  comfort_rating   int check (comfort_rating between 1 and 5 or comfort_rating is null),
  performance_rating int check (performance_rating between 1 and 5 or performance_rating is null),
  maintenance_rating int check (maintenance_rating between 1 and 5 or maintenance_rating is null),
  pros             text,
  cons             text,
  comment          text,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason    text,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  unique (bike_model_id, user_id)
);
create index if not exists idx_reviews_model on public.reviews (bike_model_id);
create index if not exists idx_reviews_status on public.reviews (status);

create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  item_type  text not null check (item_type in ('bike', 'used_bike', 'comparison')),
  item_id    uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);
create index if not exists idx_favs_user on public.favorites (user_id);

create table if not exists public.comparisons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);
create table if not exists public.comparison_items (
  id           uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.comparisons (id) on delete cascade,
  model_id     uuid not null references public.bike_models (id) on delete cascade,
  position     int not null default 0,
  unique (comparison_id, model_id)
);

create table if not exists public.enquiries (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('contact_seller', 'dealer_offer', 'callback', 'general')),
  bike_model_id uuid references public.bike_models (id) on delete set null,
  used_bike_id  uuid references public.used_bikes (id) on delete set null,
  dealer_offer_id uuid references public.dealer_offers (id) on delete set null,
  to_user_id    uuid,
  to_dealer_id  uuid,
  from_user_id  uuid references public.profiles (id) on delete set null,
  from_name     text not null,
  from_phone    text not null default '',
  from_email    text,
  message       text,
  status        text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_enquiries_to_user on public.enquiries (to_user_id);
create index if not exists idx_enquiries_to_dealer on public.enquiries (to_dealer_id);
create index if not exists idx_enquiries_from on public.enquiries (from_user_id);

create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  item_type      text not null check (item_type in ('used_bike', 'dealer_offer', 'dealer', 'bike', 'review', 'other')),
  item_id        text not null,
  item_label     text,
  user_id        uuid,
  reason         text not null check (reason in ('fake_listing', 'fraud', 'wrong_information', 'duplicate', 'wrong_price', 'sold', 'other')),
  details        text,
  status         text not null default 'open' check (status in ('open', 'reviewed', 'resolved', 'dismissed')),
  resolution_note text,
  resolved_by    uuid,
  resolved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_reports_status on public.reports (status);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifs_user on public.notifications (user_id, is_read, created_at);

-- ─── Content & settings ─────────────────────────────────────────────────────
create table if not exists public.seo_pages (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null,
  meta_title       text,
  meta_description text,
  body             text not null default '',
  updated_at       timestamptz not null default now()
);

create table if not exists public.articles (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  subtitle        text,
  body            text not null,
  image_path      text,
  category        text not null default 'guide' check (category in ('guide', 'news', 'tips', 'faq')),
  is_published    boolean not null default false,
  is_featured     boolean not null default false,
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.faqs (
  id         uuid primary key default gen_random_uuid(),
  question   text not null,
  answer     text not null,
  category   text,
  sort_order int not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- audit trail of admin actions (written by a security-definer trigger)
create table if not exists public.admin_logs (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid,
  action        text not null,          -- 'insert' | 'update' | 'delete' | 'custom'
  record_type   text not null,          -- table name
  record_id     text,
  previous_data jsonb,
  new_data      jsonb,
  meta          jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_admin_logs_type on public.admin_logs (record_type, created_at);

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.image_processing_jobs (
  id          uuid primary key default gen_random_uuid(),
  table_name  text not null default 'bike_images',
  image_id    uuid not null,
  status      text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'skipped')),
  error       text,
  created_at  timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_jobs_image on public.image_processing_jobs (image_id);

-- ─── updated_at housekeeping ────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','brands','bike_models','dealer_profiles','dealer_offers','used_bikes','articles']
  loop
    execute format('drop trigger if exists trg_%s_touch on public.%I', t, t);
    execute format('create trigger trg_%s_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;

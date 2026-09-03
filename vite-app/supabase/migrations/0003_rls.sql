-- ═══════════════════════════════════════════════════════════════════════════
-- CompareBike — 0003_rls.sql
-- Row-level security on EVERY table. No table is left without RLS.
-- Public visitors (anon) can only read published/approved data.
-- Run after 0002.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles            enable row level security;
alter table public.user_roles          enable row level security;
alter table public.brands              enable row level security;
alter table public.bike_models         enable row level security;
alter table public.bike_variants       enable row level security;
alter table public.bike_colours        enable row level security;
alter table public.bike_images         enable row level security;
alter table public.specification_groups enable row level security;
alter table public.specifications      enable row level security;
alter table public.bike_specifications enable row level security;
alter table public.bike_features       enable row level security;
alter table public.bike_pros           enable row level security;
alter table public.bike_cons           enable row level security;
alter table public.dealer_profiles     enable row level security;
alter table public.dealer_documents    enable row level security;
alter table public.dealer_offers       enable row level security;
alter table public.used_bikes          enable row level security;
alter table public.used_bike_images    enable row level security;
alter table public.used_bike_documents enable row level security;
alter table public.reviews             enable row level security;
alter table public.favorites           enable row level security;
alter table public.comparisons         enable row level security;
alter table public.comparison_items    enable row level security;
alter table public.enquiries           enable row level security;
alter table public.reports             enable row level security;
alter table public.notifications       enable row level security;
alter table public.seo_pages           enable row level security;
alter table public.articles            enable row level security;
alter table public.faqs                enable row level security;
alter table public.admin_logs          enable row level security;
alter table public.site_settings       enable row level security;
alter table public.image_processing_jobs enable row level security;

-- ─── profiles ─────────────────────────────────────────────────────────────
-- NOTE: profiles are readable by everyone (marketplace display names). If you
-- want stricter PII handling, replace the public policy below with a read on
-- a dedicated view exposing only full_name.
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select using (true);
drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self" on public.profiles for select using (id = auth.uid());
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'user'));
-- (role changes are additionally blocked by the protect_profile_role trigger)
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── user_roles ───────────────────────────────────────────────────────────
drop policy if exists "user_roles_admin" on public.user_roles;
create policy "user_roles_admin" on public.user_roles for select to authenticated
  using (public.is_admin());
-- writes only via security-definer grant_role()

-- ─── brands ───────────────────────────────────────────────────────────────
drop policy if exists "brands_public" on public.brands;
create policy "brands_public" on public.brands for select
  using (is_active = true or public.is_admin());
drop policy if exists "brands_admin_write" on public.brands;
create policy "brands_admin_write" on public.brands for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── bike_models ──────────────────────────────────────────────────────────
drop policy if exists "models_public" on public.bike_models;
create policy "models_public" on public.bike_models for select
  using (is_published = true or public.is_admin());
drop policy if exists "models_admin_write" on public.bike_models;
create policy "models_admin_write" on public.bike_models for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── bike child tables (visible when the parent model is public) ──────────
drop policy if exists "variants_public" on public.bike_variants;
create policy "variants_public" on public.bike_variants for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "colours_public" on public.bike_colours;
create policy "colours_public" on public.bike_colours for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "bike_images_public" on public.bike_images;
create policy "bike_images_public" on public.bike_images for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "bike_specs_public" on public.bike_specifications;
create policy "bike_specs_public" on public.bike_specifications for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "features_public" on public.bike_features;
create policy "features_public" on public.bike_features for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "pros_public" on public.bike_pros;
create policy "pros_public" on public.bike_pros for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));
drop policy if exists "cons_public" on public.bike_cons;
create policy "cons_public" on public.bike_cons for select
  using (public.is_admin() or exists (select 1 from public.bike_models m where m.id = bike_model_id and m.is_published));

-- admin-only writes on all bike child tables
do $$
declare t text;
begin
  foreach t in array array['bike_variants','bike_colours','bike_images','bike_specifications','bike_features','bike_pros','bike_cons']
  loop
    execute format('drop policy if exists "%s_admin_write" on public.%I', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end;
$$;

-- ─── specification definitions ────────────────────────────────────────────
drop policy if exists "spec_groups_public" on public.specification_groups;
create policy "spec_groups_public" on public.specification_groups for select using (true);
drop policy if exists "specs_public" on public.specifications;
create policy "specs_public" on public.specifications for select using (true);
drop policy if exists "spec_groups_admin_write" on public.specification_groups;
create policy "spec_groups_admin_write" on public.specification_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "specs_admin_write" on public.specifications;
create policy "specs_admin_write" on public.specifications for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── dealer_profiles ──────────────────────────────────────────────────────
-- public sees approved dealers; owner sees own; admin sees all.
drop policy if exists "dealers_public" on public.dealer_profiles;
create policy "dealers_public" on public.dealer_profiles for select
  using (status = 'approved' or public.is_admin());
drop policy if exists "dealers_select_self" on public.dealer_profiles;
create policy "dealers_select_self" on public.dealer_profiles for select to authenticated
  using (user_id = auth.uid());
-- owner may create one application and (re)submit only while waiting/rejected
drop policy if exists "dealers_insert_self" on public.dealer_profiles;
create policy "dealers_insert_self" on public.dealer_profiles for insert to authenticated
  with check (user_id = auth.uid() and status = 'waiting');
drop policy if exists "dealers_update_self_resubmit" on public.dealer_profiles;
create policy "dealers_update_self_resubmit" on public.dealer_profiles for update to authenticated
  using (user_id = auth.uid() and status in ('waiting', 'rejected'))
  with check (user_id = auth.uid() and status in ('waiting', 'rejected'));
-- suspended dealers cannot self-resubmit (only admin can change their status)
drop policy if exists "dealers_admin_write" on public.dealer_profiles;
create policy "dealers_admin_write" on public.dealer_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── dealer_documents (PRIVATE) ───────────────────────────────────────────
drop policy if exists "dealer_docs_owner" on public.dealer_documents;
create policy "dealer_docs_owner" on public.dealer_documents for select to authenticated
  using (public.is_admin() or dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()));
drop policy if exists "dealer_docs_insert_owner" on public.dealer_documents;
create policy "dealer_docs_insert_owner" on public.dealer_documents for insert to authenticated
  with check (dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()));
drop policy if exists "dealer_docs_admin_write" on public.dealer_documents;
create policy "dealer_docs_admin_write" on public.dealer_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── dealer_offers ────────────────────────────────────────────────────────
drop policy if exists "offers_public" on public.dealer_offers;
create policy "offers_public" on public.dealer_offers for select
  using (status = 'approved' or public.is_admin());
drop policy if exists "offers_select_own" on public.dealer_offers;
create policy "offers_select_own" on public.dealer_offers for select to authenticated
  using (dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()));
drop policy if exists "offers_insert_own" on public.dealer_offers;
create policy "offers_insert_own" on public.dealer_offers for insert to authenticated
  with check (dealer_id in (select id from public.dealer_profiles where user_id = auth.uid())
              and status = 'waiting'
              and dealer_id in (select id from public.dealer_profiles where status = 'approved'));
-- owner can only move their own offers back to waiting (resubmit after rejection)
drop policy if exists "offers_update_own_resubmit" on public.dealer_offers;
create policy "offers_update_own_resubmit" on public.dealer_offers for update to authenticated
  using (dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()))
  with check (status in ('waiting', 'rejected'));
drop policy if exists "offers_admin_write" on public.dealer_offers;
create policy "offers_admin_write" on public.dealer_offers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── used_bikes ───────────────────────────────────────────────────────────
drop policy if exists "used_public" on public.used_bikes;
create policy "used_public" on public.used_bikes for select
  using (status = 'approved' or public.is_admin());
drop policy if exists "used_select_own" on public.used_bikes;
create policy "used_select_own" on public.used_bikes for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "used_insert_own" on public.used_bikes;
create policy "used_insert_own" on public.used_bikes for insert to authenticated
  with check (user_id = auth.uid()
              and status in ('draft', 'submitted', 'waiting_approval')
              and is_verified_listing = false);
-- owner may edit / resubmit own listings, but may never mark them verified.
-- Once approved, further changes go through the admin.
drop policy if exists "used_update_own" on public.used_bikes;
create policy "used_update_own" on public.used_bikes for update to authenticated
  using (user_id = auth.uid() and status in ('draft', 'submitted', 'waiting_approval', 'rejected', 'changes_required'))
  with check (user_id = auth.uid() and is_verified_listing = false
              and status in ('draft', 'submitted', 'waiting_approval'));
drop policy if exists "used_admin_write" on public.used_bikes;
create policy "used_admin_write" on public.used_bikes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── used_bike_images (public bucket, rows visible with listing) ─────────
drop policy if exists "used_imgs_public" on public.used_bike_images;
create policy "used_imgs_public" on public.used_bike_images for select
  using (public.is_admin() or exists (select 1 from public.used_bikes u where u.id = used_bike_id and u.status = 'approved'));
drop policy if exists "used_imgs_select_own" on public.used_bike_images;
create policy "used_imgs_select_own" on public.used_bike_images for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "used_imgs_insert_own" on public.used_bike_images;
create policy "used_imgs_insert_own" on public.used_bike_images for insert to authenticated
  with check (user_id = auth.uid() and used_bike_id in (select id from public.used_bikes where user_id = auth.uid()));
drop policy if exists "used_imgs_delete_own" on public.used_bike_images;
create policy "used_imgs_delete_own" on public.used_bike_images for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists "used_imgs_admin_write" on public.used_bike_images;
create policy "used_imgs_admin_write" on public.used_bike_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── used_bike_documents (PRIVATE) ────────────────────────────────────────
drop policy if exists "used_docs_owner" on public.used_bike_documents;
create policy "used_docs_owner" on public.used_bike_documents for select to authenticated
  using (public.is_admin() or user_id = auth.uid());
drop policy if exists "used_docs_insert_own" on public.used_bike_documents;
create policy "used_docs_insert_own" on public.used_bike_documents for insert to authenticated
  with check (user_id = auth.uid() and used_bike_id in (select id from public.used_bikes where user_id = auth.uid()));
drop policy if exists "used_docs_delete_own" on public.used_bike_documents;
create policy "used_docs_delete_own" on public.used_bike_documents for delete to authenticated
  using (user_id = auth.uid());
drop policy if exists "used_docs_admin_write" on public.used_bike_documents;
create policy "used_docs_admin_write" on public.used_bike_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── reviews ──────────────────────────────────────────────────────────────
drop policy if exists "reviews_public" on public.reviews;
create policy "reviews_public" on public.reviews for select using (status = 'approved');
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "reviews_admin_write" on public.reviews;
create policy "reviews_admin_write" on public.reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── favorites / comparisons (own only) ───────────────────────────────────
drop policy if exists "favs_own" on public.favorites;
create policy "favs_own" on public.favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "comparisons_own" on public.comparisons;
create policy "comparisons_own" on public.comparisons for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "comparison_items_own" on public.comparison_items;
create policy "comparison_items_own" on public.comparison_items for all to authenticated
  using (comparison_id in (select id from public.comparisons where user_id = auth.uid()))
  with check (comparison_id in (select id from public.comparisons where user_id = auth.uid()));

-- ─── enquiries ────────────────────────────────────────────────────────────
-- anyone (incl. logged-out) can submit; recipients and admin can read.
drop policy if exists "enquiries_insert" on public.enquiries;
create policy "enquiries_insert" on public.enquiries for insert
  with check (from_user_id is null or from_user_id = auth.uid());
drop policy if exists "enquiries_select" on public.enquiries;
create policy "enquiries_select" on public.enquiries for select to authenticated
  using (public.is_admin()
         or from_user_id = auth.uid()
         or to_user_id = auth.uid()
         or to_dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()));
drop policy if exists "enquiries_update_own" on public.enquiries;
create policy "enquiries_update_own" on public.enquiries for update to authenticated
  using (public.is_admin()
         or to_user_id = auth.uid()
         or to_dealer_id in (select id from public.dealer_profiles where user_id = auth.uid()))
  with check (status in ('contacted', 'closed'));

-- ─── reports ──────────────────────────────────────────────────────────────
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports for insert
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "reports_admin_all" on public.reports;
create policy "reports_admin_all" on public.reports for select to authenticated
  using (public.is_admin());
drop policy if exists "reports_admin_update" on public.reports;
create policy "reports_admin_update" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── notifications (own only; inserts happen via triggers) ───────────────
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete to authenticated
  using (user_id = auth.uid());
-- no direct insert policy — rows are created only by security-definer triggers.

-- ─── content & settings ───────────────────────────────────────────────────
drop policy if exists "seo_pages_public" on public.seo_pages;
create policy "seo_pages_public" on public.seo_pages for select using (true);
drop policy if exists "seo_pages_admin_write" on public.seo_pages;
create policy "seo_pages_admin_write" on public.seo_pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "articles_public" on public.articles;
create policy "articles_public" on public.articles for select using (is_published or public.is_admin());
drop policy if exists "articles_admin_write" on public.articles;
create policy "articles_admin_write" on public.articles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "faqs_public" on public.faqs;
create policy "faqs_public" on public.faqs for select using (is_active or public.is_admin());
drop policy if exists "faqs_admin_write" on public.faqs;
create policy "faqs_admin_write" on public.faqs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "site_settings_public" on public.site_settings;
create policy "site_settings_public" on public.site_settings for select using (true);
drop policy if exists "site_settings_admin_write" on public.site_settings;
create policy "site_settings_admin_write" on public.site_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── admin_logs (read-only for admins; written only by the audit trigger) ─
drop policy if exists "admin_logs_select" on public.admin_logs;
create policy "admin_logs_select" on public.admin_logs for select to authenticated
  using (public.is_admin());

-- ─── image_processing_jobs (admin visibility; written by edge function) ──
drop policy if exists "jobs_admin" on public.image_processing_jobs;
create policy "jobs_admin" on public.image_processing_jobs for select to authenticated
  using (public.is_admin());

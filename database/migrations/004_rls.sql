-- ===========================================================================
-- Bikepick.IN — 004_rls.sql
-- Row Level Security for the Supabase/PostgreSQL deployment.
--
-- RUN ON:  Supabase (PostgreSQL) — apply AFTER 001/002/003, one time.
-- SKIP ON: SQLite (local/dev) — has no RLS; the API layer enforces RBAC.
--
-- Model:
--   * RLS is ENABLED on every table (fail-closed).
--   * `app`       — the application role (DATABASE_URL user): FULL access,
--                   same as before RLS (it is the trusted backend).
--   * `anon` and `authenticated` — Supabase REST roles: READ-ONLY, and only
--                   on public catalog rows that the app itself publishes
--                   (same predicates the app's public queries use).
--   * Everything else (users, sessions, leads, documents, payments,
--     settings, audit logs, …) has NO policy for REST roles → denied.
--   * `postgres` (owner) and `service_role` are unaffected (owner
--     exemption / BYPASSRLS), so dashboard + service-role work continues.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1) Enable RLS on every base table in public
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;

-- --------------------------------------------------------------------------
-- 2) `app` role: full access on every table (trusted application backend)
-- --------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS app_full ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY app_full ON public.%I FOR ALL TO app USING (true) WITH CHECK (true)', t);
  END LOOP;
END
$$;

-- --------------------------------------------------------------------------
-- 3) Public catalog — read-only for anon + authenticated.
--    Predicates mirror the app's own public listing queries.
-- --------------------------------------------------------------------------

-- taxonomy (no published-flag on these tables; active + not deleted)
DROP POLICY IF EXISTS anon_brands      ON public.brands;
CREATE POLICY anon_brands      ON public.brands      FOR SELECT TO anon, authenticated USING (active = 1 AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_categories  ON public.categories;
CREATE POLICY anon_categories  ON public.categories  FOR SELECT TO anon, authenticated USING (active = 1 AND deleted_at IS NULL);

-- products + direct child data (shown on public product/compare pages)
DROP POLICY IF EXISTS anon_products    ON public.products;
CREATE POLICY anon_products    ON public.products    FOR SELECT TO anon, authenticated USING (status = 'published' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_variants    ON public.product_variants;
CREATE POLICY anon_variants    ON public.product_variants FOR SELECT TO anon, authenticated USING (status = 'active' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_bike_specs  ON public.bike_specs;
CREATE POLICY anon_bike_specs  ON public.bike_specs  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_ev_specs    ON public.ev_specs;
CREATE POLICY anon_ev_specs    ON public.ev_specs    FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_mobile_specs ON public.mobile_specs;
CREATE POLICY anon_mobile_specs ON public.mobile_specs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_electronics_specs ON public.electronics_specs;
CREATE POLICY anon_electronics_specs ON public.electronics_specs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_product_images ON public.product_images;
CREATE POLICY anon_product_images ON public.product_images FOR SELECT TO anon, authenticated USING (approved = 1 AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_product_prices ON public.product_prices;
CREATE POLICY anon_product_prices ON public.product_prices FOR SELECT TO anon, authenticated USING (true);

-- used-bike marketplace (only approved/live listings)
DROP POLICY IF EXISTS anon_used_bikes ON public.used_bikes;
CREATE POLICY anon_used_bikes ON public.used_bikes FOR SELECT TO anon, authenticated USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_used_bike_images ON public.used_bike_images;
CREATE POLICY anon_used_bike_images ON public.used_bike_images FOR SELECT TO anon, authenticated USING (true);

-- dealers (approved only) + their approved offers
DROP POLICY IF EXISTS anon_dealer_profiles ON public.dealer_profiles;
CREATE POLICY anon_dealer_profiles ON public.dealer_profiles FOR SELECT TO anon, authenticated USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_dealer_offers ON public.dealer_offers;
CREATE POLICY anon_dealer_offers ON public.dealer_offers FOR SELECT TO anon, authenticated USING (status = 'approved' AND deleted_at IS NULL);

-- content: approved reviews, published articles, public comparisons,
-- verified service centres, public SEO metadata
DROP POLICY IF EXISTS anon_reviews ON public.reviews;
CREATE POLICY anon_reviews ON public.reviews FOR SELECT TO anon, authenticated USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_articles ON public.articles;
CREATE POLICY anon_articles ON public.articles FOR SELECT TO anon, authenticated USING (published = 1 AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_comparisons ON public.comparisons;
CREATE POLICY anon_comparisons ON public.comparisons FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS anon_service_centres ON public.service_centres;
CREATE POLICY anon_service_centres ON public.service_centres FOR SELECT TO anon, authenticated USING (status = 'active' AND deleted_at IS NULL);
DROP POLICY IF EXISTS anon_seo_metadata ON public.seo_metadata;
CREATE POLICY anon_seo_metadata ON public.seo_metadata FOR SELECT TO anon, authenticated USING (true);

-- No policies on any other table for anon/authenticated → denied by RLS.

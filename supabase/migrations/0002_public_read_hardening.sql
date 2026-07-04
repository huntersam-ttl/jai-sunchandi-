-- =====================================================================
-- 0002 — public read hardening (clears security-advisor ERRORs from 0001)
--
-- 0001 exposed public data via SECURITY DEFINER views, which Supabase's linter
-- flags (a definer view can silently bypass RLS). This migration switches the
-- public_* views to SECURITY INVOKER and backs them with explicit anon SELECT
-- policies plus COLUMN-LEVEL grants, so:
--   * the views respect the querying role's RLS (no definer bypass), and
--   * anon can read only non-cost product columns of website-visible rows —
--     cost/profit columns are never granted to anon, even on the base table.
-- Also pins a non-mutable search_path on the trigger function.
-- =====================================================================

-- 1. Views respect the caller's RLS instead of the definer's.
alter view public_shop_settings set (security_invoker = true);
alter view public_categories    set (security_invoker = true);
alter view public_collections   set (security_invoker = true);
alter view public_products      set (security_invoker = true);
alter view public_daily_rates   set (security_invoker = true);

-- 2. anon SELECT policies (safe rows only) on the tables backing those views.
--    (SELECT policies with USING (true) are the intended public-read pattern
--     and are not flagged by the linter.)
create policy "public_read_shop_settings" on shop_settings for select to anon using (true);
create policy "public_read_categories"    on categories    for select to anon using (is_active = true);
create policy "public_read_collections"   on collections   for select to anon using (is_active = true);
create policy "public_read_daily_rates"   on daily_rates   for select to anon using (true);
create policy "public_read_products"      on products      for select to anon
  using (show_on_website = true and is_deleted = false and status not in ('sold','inactive'));

-- 3. Column-level grants: anon may read ONLY these non-cost product columns,
--    even querying the base table directly. jarti/jyala/stone/polishing/cutting/
--    worker/other costs are intentionally NOT granted to anon.
revoke select on products from anon;
grant select (id, product_code, name, name_np, description, category, collection,
              metal, purity, weight_grams, status, show_price_on_website, photos)
  on products to anon;

-- 4. Pin the trigger function's search_path (advisor: function_search_path_mutable).
alter function public.set_updated_at() set search_path = '';

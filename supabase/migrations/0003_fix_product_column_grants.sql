-- =====================================================================
-- 0003 — fix anon column grants for the security-invoker public_products view
--
-- The public_products view (SECURITY INVOKER since 0002) filters on
-- show_on_website and is_deleted in its WHERE clause. Postgres column-level
-- privileges apply to columns referenced in WHERE, not just the SELECT list, so
-- anon must also hold SELECT on those two (non-sensitive) visibility flags or
-- the view errors with "permission denied for table products".
--
-- Cost/profit columns remain ungranted to anon.
-- =====================================================================

grant select (show_on_website, is_deleted) on products to anon;

-- =====================================================================
-- 0009 — indexes for admin list/search endpoints
--
-- The admin products/orders/customers list routes now push q= search and
-- filters into SQL (previously done in Python after fetching every row).
-- These are the columns that filter/search now hits that didn't already
-- have an index.
-- =====================================================================

create index if not exists idx_orders_customer_phone on orders (customer_phone);
create index if not exists idx_customers_name on customers (name);
create index if not exists idx_products_name on products (name);
create index if not exists idx_products_category on products (category);
create index if not exists idx_products_show_on_website on products (show_on_website);

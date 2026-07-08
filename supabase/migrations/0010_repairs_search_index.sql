-- =====================================================================
-- 0010 — indexes for admin quick search (repairs)
--
-- The new GET /api/admin/search endpoint searches repairs by customer_name
-- and customer_phone (repair_number is already covered by its unique
-- constraint). These two didn't have an index yet.
-- =====================================================================

create index if not exists idx_repairs_customer_name on repair_jobs (customer_name);
create index if not exists idx_repairs_customer_phone on repair_jobs (customer_phone);

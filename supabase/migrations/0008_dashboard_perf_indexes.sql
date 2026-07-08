-- =====================================================================
-- 0008 — dashboard performance indexes
--
-- Most of the columns the admin dashboard filters/sorts on already have
-- indexes from 0001_init.sql (orders.status, orders.delivery_date_ad,
-- payments.payment_date_ad, leads.status, repairs.status,
-- admin_tasks.status, admin_tasks.due_date_ad). This adds the two that were
-- missing, both now used by capped/sorted dashboard queries.
-- =====================================================================

create index if not exists idx_leads_created_at on leads (created_at desc);
create index if not exists idx_repairs_promised_date on repair_jobs (promised_date_ad);

-- Leads was the one historical/customer-related table without the is_deleted
-- soft-delete column every other such table (products, customers, orders,
-- repair_jobs, bill_archives) already has. Adding it here for consistency
-- rather than overloading the existing status enum (new/contacted/converted/
-- closed) with an "archived" value that would collide with that lifecycle.
alter table leads add column if not exists is_deleted boolean not null default false;
create index if not exists idx_leads_is_deleted on leads (is_deleted);

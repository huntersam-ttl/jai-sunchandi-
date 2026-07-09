-- =====================================================================
-- 0011 — bill_archives: photo archive of hand-written physical bills
--
-- Lets the shop store photos/scans of the physical bills dad writes by
-- hand, searchable later by phone/name/bill number/date, and optionally
-- linked to an existing order/repair/customer record. Admin-only; never
-- exposed through the public_* views or anon policies.
-- =====================================================================

create table bill_archives (
  id uuid primary key default gen_random_uuid(),
  bill_number text,
  customer_name text,
  customer_phone text,
  bill_date date,
  total_amount numeric(12,2),
  payment_status text not null default 'unknown',
  related_order_id uuid references orders(id),
  related_repair_id uuid references repair_jobs(id),
  related_customer_id uuid references customers(id),
  image_path text not null,
  notes text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_bill_archives_customer_phone on bill_archives (customer_phone);
create index idx_bill_archives_customer_name on bill_archives (customer_name);
create index idx_bill_archives_bill_number on bill_archives (bill_number);
create index idx_bill_archives_bill_date on bill_archives (bill_date);
create index idx_bill_archives_related_order on bill_archives (related_order_id);
create index idx_bill_archives_related_repair on bill_archives (related_repair_id);

create trigger trg_bill_archives_updated before update on bill_archives
  for each row execute function set_updated_at();

alter table bill_archives enable row level security;
create policy "admin_all" on bill_archives for all to authenticated using (true) with check (true);
-- No anon policy at all -- RLS denies every anon read/write, same as the
-- other business tables (customers/orders/payments/etc).

-- Storage: private bucket for bill photos, admin-managed only (mirrors the
-- repair-photos/lead-photos pattern, but with no anon-insert policy since
-- bills are only ever uploaded by the admin, never by a public form).
insert into storage.buckets (id, name, public) values ('bill-photos', 'bill-photos', false)
on conflict (id) do nothing;

create policy "admin_manage_bill_photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'bill-photos')
  with check (bucket_id = 'bill-photos');

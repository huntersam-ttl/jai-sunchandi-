-- =====================================================================
-- 0005 — expenses and cashbook foundation
--
-- Adds an admin-only expenses table for cash movement tracking. Cashbook
-- combines this table with existing order payments in the FastAPI backend.
-- This is cash flow only, not profit/loss.
-- =====================================================================

create table expenses (
  id uuid primary key default gen_random_uuid(),
  date_ad date not null default current_date,
  category text not null default 'other',
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_expenses_date on expenses (date_ad);

create trigger trg_expenses_updated
  before update on expenses
  for each row execute function set_updated_at();

alter table expenses enable row level security;

create policy "admin_all" on expenses
  for all to authenticated
  using (true)
  with check (true);

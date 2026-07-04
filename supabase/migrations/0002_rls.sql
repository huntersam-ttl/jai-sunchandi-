-- =============================================================================
-- 0002_rls.sql
-- Row Level Security policies for Supabase.
--
-- Strategy:
--   • shop_settings, categories, collections, daily_rates, products,
--     public_leads → public read (anon can SELECT)
--   • Everything else → authenticated (service_role or authed user) only
--   • service_role always bypasses RLS — used by the FastAPI backend
--   • anon key is used only by the public-facing React frontend
-- =============================================================================

-- Enable RLS on every table
alter table users              enable row level security;
alter table shop_settings      enable row level security;
alter table categories         enable row level security;
alter table collections        enable row level security;
alter table daily_rates        enable row level security;
alter table products           enable row level security;
alter table customers          enable row level security;
alter table orders             enable row level security;
alter table payments           enable row level security;
alter table invoices           enable row level security;
alter table repair_jobs        enable row level security;
alter table certificates       enable row level security;
alter table public_leads       enable row level security;
alter table counters           enable row level security;

-- ---------------------------------------------------------------------------
-- Public-read tables (anon can SELECT; only service_role can mutate)
-- ---------------------------------------------------------------------------
-- shop_settings
create policy "public can read shop settings"
    on shop_settings for select using (true);

create policy "service role can modify shop settings"
    on shop_settings for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- categories
create policy "public can read categories"
    on categories for select using (true);

create policy "service role can modify categories"
    on categories for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- collections
create policy "public can read collections"
    on collections for select using (true);

create policy "service role can modify collections"
    on collections for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- daily_rates (public today's rates widget on website)
create policy "public can read daily rates"
    on daily_rates for select using (true);

create policy "service role can modify daily rates"
    on daily_rates for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- products (catalogue on website)
create policy "public can read available products"
    on products for select
    using (show_on_website = true and is_deleted = false);

create policy "service role can modify products"
    on products for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- public_leads (anon INSERT for enquiry form; no read)
create policy "anon can submit lead"
    on public_leads for insert
    with check (true);

create policy "service role can read and modify leads"
    on public_leads for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Admin-only tables (service_role only — FastAPI handles auth at app level)
-- ---------------------------------------------------------------------------
create policy "service role only — users"
    on users for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — customers"
    on customers for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — orders"
    on orders for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — payments"
    on payments for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — invoices"
    on invoices for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — repair_jobs"
    on repair_jobs for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — certificates"
    on certificates for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "service role only — counters"
    on counters for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

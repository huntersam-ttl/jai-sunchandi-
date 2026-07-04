-- =====================================================================
-- Jai Supa Deurali Sun-Chandi Pasal — Supabase V1 initial schema
-- Migration: 0001_init
--
-- Creates all V1 tables, constraints, indexes, sequences, the updated_at
-- trigger, RLS policies, public-safe read views, and Storage buckets.
--
-- Security model:
--   * FastAPI backend connects with the SERVICE ROLE key (bypasses RLS) and
--     mediates ALL business data. The service role key must NEVER be shipped
--     to the frontend.
--   * anon (public, unauthenticated): can INSERT leads, and can SELECT ONLY
--     the curated public_* views (safe columns / safe rows). No direct read
--     of base tables — cost, customer, order, payment and khata data are
--     never exposed publicly.
--   * authenticated (the logged-in admin via Supabase Auth): full access
--     (defense-in-depth backstop; the backend uses the service role).
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- Sequences for human-readable codes (JSD-P-0001 / ORD-0001 / REP-0001)
-- ---------------------------------------------------------------------
create sequence if not exists product_code_seq start 1;
create sequence if not exists order_number_seq start 1;
create sequence if not exists repair_number_seq start 1;

-- ---------------------------------------------------------------------
-- shop_settings (singleton)
-- ---------------------------------------------------------------------
create table shop_settings (
  id boolean primary key default true,
  constraint shop_settings_singleton check (id = true),
  shop_name text not null default 'Jai Supa Deurali Sun-Chandi Pasal',
  shop_name_np text not null default 'जय सुपा देउराली सुनचाँदी पसल',
  tagline text not null default 'Decades of trust in gold & silver',
  tagline_np text not null default 'दशकौंदेखिको विश्वास',
  phone text not null default '',
  whatsapp text not null default '',
  address text not null default '',
  maps_link text not null default '',
  opening_hours text not null default '',
  logo_url text not null default '',
  default_whatsapp_message text not null default 'Namaste! I have an enquiry.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- categories / collections
-- ---------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- daily_rates
-- ---------------------------------------------------------------------
create table daily_rates (
  id uuid primary key default gen_random_uuid(),
  date_ad date not null unique,
  bs_date text not null default '',
  bs_date_np text not null default '',
  bs_date_long_np text not null default '',
  gold_24k numeric(12,2) not null check (gold_24k >= 0),
  gold_22k numeric(12,2) not null check (gold_22k >= 0),
  silver numeric(12,2) not null check (silver >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_daily_rates_date on daily_rates (date_ad desc);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique
    default ('JSD-P-' || lpad(nextval('product_code_seq')::text, 4, '0')),
  name text not null,
  name_np text not null default '',
  description text not null default '',
  category text not null default '',
  collection text not null default '',
  metal text not null default 'gold' check (metal in ('gold','silver')),
  purity text not null default '24K' check (purity in ('24K','22K','18K','silver')),
  weight_grams numeric(12,3) not null check (weight_grams > 0),
  jarti_percent numeric(6,3) not null default 0,
  jyala_amount numeric(12,2) not null default 0,
  jyala_type text not null default 'flat' check (jyala_type in ('flat','per_tola')),
  stone_cost numeric(12,2) not null default 0,
  polishing_cost numeric(12,2) not null default 0,
  cutting_cost numeric(12,2) not null default 0,
  worker_charge numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  status text not null default 'available'
    check (status in ('available','reserved','sold','inactive')),
  show_on_website boolean not null default true,
  show_price_on_website boolean not null default true,
  photos text[] not null default '{}',   -- Supabase Storage URLs (not base64)
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_status on products (status);
create index idx_products_is_deleted on products (is_deleted);
create index idx_products_metal on products (metal);

-- ---------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  address text not null default '',
  notes text not null default '',
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_phone on customers (phone);

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('ORD-' || lpad(nextval('order_number_seq')::text, 4, '0')),
  customer_id uuid not null references customers(id) on delete restrict,
  customer_name text not null,     -- denormalised snapshot
  customer_phone text not null,    -- denormalised snapshot
  order_type text not null default 'purchase'
    check (order_type in ('purchase','custom_order','repair')),
  custom_description text not null default '',
  reference_photo_url text not null default '',
  order_date_ad date not null default current_date,
  order_date_bs text not null default '',
  order_date_bs_np text not null default '',
  delivery_date_ad date,
  delivery_date_bs text,
  delivery_date_bs_np text,
  delivery_time text not null default '',
  status text not null default 'new'
    check (status in ('new','in_progress','making','polishing','ready','delivered','cancelled')),
  notes text not null default '',
  old_gold jsonb,                  -- frozen exchange snapshot, read as a unit
  total_price numeric(12,2) not null default 0,
  old_gold_value numeric(12,2) not null default 0,
  net_payable numeric(12,2) not null default 0,
  advance_total numeric(12,2) not null default 0,
  remaining_balance numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partial','paid')),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_orders_customer on orders (customer_id);
create index idx_orders_status on orders (status);
create index idx_orders_delivery on orders (delivery_date_ad);
create index idx_orders_is_deleted on orders (is_deleted);
create index idx_orders_payment_status on orders (payment_status);

-- ---------------------------------------------------------------------
-- order_items (frozen price snapshots; real child table)
-- ---------------------------------------------------------------------
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  metal text not null default 'gold',
  purity text not null default '24K',
  weight_grams numeric(12,3) not null,
  weight_tola numeric(12,4) not null default 0,
  rate_per_tola numeric(12,2) not null,
  purity_factor numeric(6,4) not null,
  metal_value numeric(12,2) not null,
  jarti_percent numeric(6,3) not null default 0,
  jarti_amount numeric(12,2) not null default 0,
  jyala_type text not null default 'flat',
  jyala_input numeric(12,2) not null default 0,
  jyala_amount numeric(12,2) not null default 0,
  stone_cost numeric(12,2) not null default 0,
  polishing_cost numeric(12,2) not null default 0,
  cutting_cost numeric(12,2) not null default 0,
  worker_charge numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total_price numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index idx_order_items_order on order_items (order_id);
create index idx_order_items_product on order_items (product_id);

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash','bank','wallet','other')),
  payment_date_ad date not null default current_date,
  payment_date_bs text not null default '',
  payment_date_bs_np text not null default '',
  note text not null default '',
  created_at timestamptz not null default now()
);
create index idx_payments_order on payments (order_id);
create index idx_payments_customer on payments (customer_id);
create index idx_payments_date on payments (payment_date_ad);

-- ---------------------------------------------------------------------
-- repair_jobs
-- ---------------------------------------------------------------------
create table repair_jobs (
  id uuid primary key default gen_random_uuid(),
  repair_number text not null unique
    default ('REP-' || lpad(nextval('repair_number_seq')::text, 4, '0')),
  customer_id uuid not null references customers(id) on delete restrict,
  customer_name text not null,
  customer_phone text not null,
  service_type text not null default 'repair'
    check (service_type in ('repair','polish','cleaning')),
  description text not null default '',
  intake_photo_url text not null default '',
  damage_photo_url text not null default '',
  after_photo_url text not null default '',
  promised_date_ad date,
  promised_date_bs text,
  promised_date_bs_np text,
  charge numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  status text not null default 'received'
    check (status in ('received','working','ready','delivered','cancelled')),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_repairs_customer on repair_jobs (customer_id);
create index idx_repairs_status on repair_jobs (status);

-- ---------------------------------------------------------------------
-- leads (public intake)
-- ---------------------------------------------------------------------
create table leads (
  id uuid primary key default gen_random_uuid(),
  lead_type text not null default 'custom_order'
    check (lead_type in ('custom_order','repair')),
  name text not null,
  phone text not null,
  item_type text not null default '',
  metal text not null default '',
  service_type text not null default '',
  approx_weight text not null default '',
  budget text not null default '',
  deadline text not null default '',
  notes text not null default '',
  photo_url text not null default '',
  status text not null default 'new'
    check (status in ('new','contacted','converted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_leads_status on leads (status);

-- ---------------------------------------------------------------------
-- admin_tasks (internal reminders / to-dos)
-- ---------------------------------------------------------------------
create table admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  related_order_id uuid references orders(id) on delete set null,
  related_customer_id uuid references customers(id) on delete set null,
  due_date_ad date,
  assigned_to text not null default '',
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_admin_tasks_status on admin_tasks (status);
create index idx_admin_tasks_due on admin_tasks (due_date_ad);

-- ---------------------------------------------------------------------
-- material_tasks (per-order material/purchase tracking)
-- ---------------------------------------------------------------------
create table material_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  material_needed text not null default '',
  material_status text not null default 'needed'
    check (material_status in ('not_needed','needed','purchased')),
  assigned_to text not null default '',
  quantity text not null default '',
  notes text not null default '',
  purchased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_material_tasks_order on material_tasks (order_id);
create index idx_material_tasks_status on material_tasks (material_status);

-- ---------------------------------------------------------------------
-- whatsapp_templates (editable manual-notification templates)
-- ---------------------------------------------------------------------
create table whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  body text not null,               -- supports {customer_name} {order_number}
                                    -- {delivery_date} {shop_name} {remaining_balance}
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create trigger trg_shop_settings_updated before update on shop_settings for each row execute function set_updated_at();
create trigger trg_categories_updated     before update on categories     for each row execute function set_updated_at();
create trigger trg_collections_updated    before update on collections    for each row execute function set_updated_at();
create trigger trg_daily_rates_updated    before update on daily_rates    for each row execute function set_updated_at();
create trigger trg_products_updated       before update on products       for each row execute function set_updated_at();
create trigger trg_customers_updated      before update on customers      for each row execute function set_updated_at();
create trigger trg_orders_updated         before update on orders         for each row execute function set_updated_at();
create trigger trg_repair_jobs_updated    before update on repair_jobs    for each row execute function set_updated_at();
create trigger trg_leads_updated          before update on leads          for each row execute function set_updated_at();
create trigger trg_admin_tasks_updated    before update on admin_tasks    for each row execute function set_updated_at();
create trigger trg_material_tasks_updated before update on material_tasks for each row execute function set_updated_at();
create trigger trg_whatsapp_templates_updated before update on whatsapp_templates for each row execute function set_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table shop_settings     enable row level security;
alter table categories        enable row level security;
alter table collections       enable row level security;
alter table daily_rates       enable row level security;
alter table products          enable row level security;
alter table customers         enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table payments          enable row level security;
alter table repair_jobs       enable row level security;
alter table leads             enable row level security;
alter table admin_tasks       enable row level security;
alter table material_tasks    enable row level security;
alter table whatsapp_templates enable row level security;

-- Admin (any authenticated Supabase user = the single shop admin) — full access.
-- Defense-in-depth: the backend uses the service role, which bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array[
    'shop_settings','categories','collections','daily_rates','products','customers',
    'orders','order_items','payments','repair_jobs','leads','admin_tasks',
    'material_tasks','whatsapp_templates'
  ]
  loop
    execute format(
      'create policy "admin_all" on %I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Public (anon) may INSERT leads only (website custom-order / repair forms).
create policy "public_insert_leads" on leads
  for insert to anon
  with check (true);

-- NOTE: anon has NO SELECT policy on any base table, so RLS denies all public
-- reads of base tables (customers, orders, payments, khata, product costs, etc.).
-- Public reads are served exclusively through the curated public_* views below.

-- =====================================================================
-- Public-safe read views (curated columns/rows; bypass base-table RLS as
-- owner-defined views). anon is granted SELECT on these only.
-- =====================================================================
create view public_shop_settings as
  select shop_name, shop_name_np, tagline, tagline_np, phone, whatsapp,
         address, maps_link, opening_hours, logo_url, default_whatsapp_message
  from shop_settings;

create view public_categories as
  select id, name, sort_order from categories where is_active = true;

create view public_collections as
  select id, name, sort_order from collections where is_active = true;

-- No cost/profit columns exposed; only website-visible, non-sold rows.
create view public_products as
  select id, product_code, name, name_np, description, category, collection,
         metal, purity, weight_grams, status, show_price_on_website, photos
  from products
  where show_on_website = true
    and is_deleted = false
    and status not in ('sold','inactive');

create view public_daily_rates as
  select date_ad, bs_date, bs_date_np, bs_date_long_np, gold_24k, gold_22k, silver
  from daily_rates;

grant select on public_shop_settings, public_categories, public_collections,
                public_products, public_daily_rates to anon, authenticated;

-- =====================================================================
-- Storage buckets
-- =====================================================================
insert into storage.buckets (id, name, public) values
  ('product-photos','product-photos', true),
  ('shop',          'shop',           true),
  ('repair-photos', 'repair-photos',  false),
  ('lead-photos',   'lead-photos',    false)
on conflict (id) do nothing;

-- Public read for the public buckets (product photos + shop logo).
create policy "public_read_public_buckets" on storage.objects
  for select to anon
  using (bucket_id in ('product-photos','shop'));

-- Authenticated admin may manage objects in all buckets (incl. private ones).
create policy "admin_manage_buckets" on storage.objects
  for all to authenticated
  using (bucket_id in ('product-photos','shop','repair-photos','lead-photos'))
  with check (bucket_id in ('product-photos','shop','repair-photos','lead-photos'));

-- =====================================================================
-- Seed data (reference only — not business records)
-- =====================================================================
insert into shop_settings (id) values (true) on conflict (id) do nothing;

insert into categories (name, sort_order) values
  ('Rings',1),('Necklaces',2),('Bangles',3),('Earrings',4),('Chains',5),
  ('Bridal Sets',6),('Silver Items',7),('Coins',8),('Custom Orders',9),('Repair/Polish',10)
on conflict (name) do nothing;

insert into collections (name, sort_order) values
  ('Bridal Collection',1),('Daily Wear',2),('Festival Collection',3),
  ('Dashain/Tihar Collection',4),('Wedding Set',5),('Silver Collection',6)
on conflict (name) do nothing;

insert into whatsapp_templates (slug, name, body, sort_order) values
  ('order_ready','Order ready for pickup',
   'Namaste {customer_name}, your order {order_number} from {shop_name} is ready for pickup. Thank you!',1),
  ('payment_reminder','Payment reminder',
   'Namaste {customer_name}, a gentle reminder: Rs. {remaining_balance} remaining on order {order_number} at {shop_name}. Thank you.',2),
  ('order_received','Order received confirmation',
   'Namaste {customer_name}, we have received your order {order_number}. Expected delivery: {delivery_date}. — {shop_name}',3),
  ('order_delayed','Order delayed',
   'Namaste {customer_name}, your order {order_number} is slightly delayed. New expected date: {delivery_date}. Sorry for the wait. — {shop_name}',4),
  ('repair_ready','Repair ready',
   'Namaste {customer_name}, your repair {order_number} at {shop_name} is ready for pickup. Thank you!',5),
  ('custom_update','Custom order update',
   'Namaste {customer_name}, an update on your custom order {order_number} at {shop_name}: ',6)
on conflict (slug) do nothing;

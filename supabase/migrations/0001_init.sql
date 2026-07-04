-- =============================================================================
-- 0001_init.sql
-- Jai Supa Deurali Sun-Chandi Pasal — initial schema
-- Mirrors the MongoDB collections in server.py exactly.
-- Run order: extensions → tables → indexes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------------
create table if not exists users (
    id          text primary key default gen_random_uuid()::text,
    email       text not null unique,
    password_hash text not null,
    name        text not null default 'Admin',
    role        text not null default 'admin',
    created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. shop_settings  (singleton row, _id = 'shop')
-- ---------------------------------------------------------------------------
create table if not exists shop_settings (
    id                      text primary key default 'shop',
    shop_name               text not null default 'Jai Supa Deurali Sun-Chandi Pasal',
    shop_name_np            text not null default 'जय सुपा देउराली सुनचाँदी पसल',
    tagline                 text not null default 'Decades of trust in gold & silver',
    tagline_np              text not null default 'दशकौंदेखिको विश्वास',
    phone                   text not null default '+977-9800000000',
    whatsapp                text not null default '9779800000000',
    address                 text not null default 'Deurali Bazaar, Nepal',
    maps_link               text not null default '',
    opening_hours           text not null default 'Sun–Fri: 10am – 7pm',
    logo                    text not null default '',
    default_whatsapp_message text not null default 'Namaste! I have an enquiry.',
    updated_at              timestamptz not null default now()
);

-- Seed the single settings row so GET /api/settings never 404s
insert into shop_settings (id) values ('shop') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. categories
-- ---------------------------------------------------------------------------
create table if not exists categories (
    id         text primary key default gen_random_uuid()::text,
    name       text not null unique,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. collections
-- ---------------------------------------------------------------------------
create table if not exists collections (
    id         text primary key default gen_random_uuid()::text,
    name       text not null unique,
    created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. daily_rates
-- ---------------------------------------------------------------------------
create table if not exists daily_rates (
    id          text primary key default gen_random_uuid()::text,
    date_ad     date not null unique,
    -- BS date fields (computed on write, stored for display)
    bs_date     text,
    bs_date_np  text,
    gold_24k    numeric(12,2) not null,
    gold_22k    numeric(12,2) not null,
    silver      numeric(12,2) not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists daily_rates_date_ad_idx on daily_rates (date_ad desc);

-- ---------------------------------------------------------------------------
-- 6. customers
-- ---------------------------------------------------------------------------
create table if not exists customers (
    id         text primary key default gen_random_uuid()::text,
    name       text not null,
    phone      text not null,
    address    text not null default '',
    notes      text not null default '',
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists customers_phone_idx  on customers (phone);
create index if not exists customers_deleted_idx on customers (is_deleted);

-- ---------------------------------------------------------------------------
-- 7. products
-- ---------------------------------------------------------------------------
create table if not exists products (
    id                   text primary key default gen_random_uuid()::text,
    product_code         text not null unique,   -- JSD-P-0001
    name                 text not null,
    name_np              text not null default '',
    description          text not null default '',
    category             text not null default '',
    collection           text not null default '',
    metal                text not null default 'gold',
    purity               text not null default '24K',
    weight_grams         numeric(10,3) not null,
    jarti_percent        numeric(8,4) not null default 0,
    jyala_amount         numeric(12,2) not null default 0,
    jyala_type           text not null default 'flat',
    stone_cost           numeric(12,2) not null default 0,
    polishing_cost       numeric(12,2) not null default 0,
    cutting_cost         numeric(12,2) not null default 0,
    worker_charge        numeric(12,2) not null default 0,
    other_cost           numeric(12,2) not null default 0,
    status               text not null default 'available',
    show_on_website      boolean not null default true,
    show_price_on_website boolean not null default true,
    photos               jsonb not null default '[]',   -- array of base64/URL strings
    is_deleted           boolean not null default false,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create index if not exists products_status_idx     on products (status);
create index if not exists products_metal_idx      on products (metal);
create index if not exists products_deleted_idx    on products (is_deleted);
create index if not exists products_website_idx    on products (show_on_website, is_deleted);

-- ---------------------------------------------------------------------------
-- 8. orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
    id                   text primary key default gen_random_uuid()::text,
    order_number         text not null unique,   -- ORD-0001
    customer_id          text not null references customers(id),
    customer_name        text not null,          -- denormalised snapshot
    customer_phone       text not null,          -- denormalised for public lookup
    order_type           text not null default 'purchase',
    items                jsonb not null default '[]',    -- frozen price snapshots
    custom_description   text not null default '',
    reference_photo      text not null default '',
    order_date_ad        date not null default current_date,
    order_date_bs        text,
    order_date_bs_np     text,
    delivery_date_ad     date,
    delivery_date_bs     text,
    delivery_date_bs_np  text,
    delivery_time        text not null default '',
    status               text not null default 'new',
    notes                text not null default '',
    old_gold             jsonb,                          -- OldGoldBody snapshot or null
    total_price          numeric(14,2) not null default 0,
    old_gold_value       numeric(14,2) not null default 0,
    net_payable          numeric(14,2) not null default 0,
    advance_total        numeric(14,2) not null default 0,
    remaining_balance    numeric(14,2) not null default 0,
    is_deleted           boolean not null default false,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);
create index if not exists orders_customer_idx     on orders (customer_id);
create index if not exists orders_phone_idx        on orders (customer_phone);
create index if not exists orders_status_idx       on orders (status);
create index if not exists orders_deleted_idx      on orders (is_deleted);
create index if not exists orders_delivery_idx     on orders (delivery_date_ad);

-- ---------------------------------------------------------------------------
-- 9. payments
-- ---------------------------------------------------------------------------
create table if not exists payments (
    id                 text primary key default gen_random_uuid()::text,
    order_id           text not null references orders(id),
    customer_id        text not null references customers(id),
    amount             numeric(14,2) not null,
    payment_date_ad    date not null default current_date,
    payment_date_bs    text,
    payment_date_bs_np text,
    method             text not null default 'cash',
    note               text not null default '',
    created_at         timestamptz not null default now()
);
create index if not exists payments_order_idx    on payments (order_id);
create index if not exists payments_customer_idx on payments (customer_id);
create index if not exists payments_date_idx     on payments (payment_date_ad);

-- ---------------------------------------------------------------------------
-- 10. invoices
-- ---------------------------------------------------------------------------
create table if not exists invoices (
    id                     text primary key default gen_random_uuid()::text,
    bill_number            text not null,
    order_id               text not null references orders(id),
    order_number           text not null,
    invoice_date_ad        date not null default current_date,
    invoice_date_bs        text,
    invoice_date_bs_np     text,
    invoice_date_bs_long_np text,
    -- Snapshot of customer at time of invoice
    customer_snapshot      jsonb not null,   -- {name, phone, address}
    items                  jsonb not null,   -- frozen order items
    old_gold               jsonb,
    total_price            numeric(14,2) not null default 0,
    old_gold_value         numeric(14,2) not null default 0,
    net_payable            numeric(14,2) not null default 0,
    advance_paid           numeric(14,2) not null default 0,
    remaining_balance      numeric(14,2) not null default 0,
    status                 text not null default 'active',
    physical_bill_photo    text not null default '',
    is_deleted             boolean not null default false,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);
-- bill_number unique only among non-cancelled active invoices (partial index)
create unique index if not exists invoices_active_bill_idx
    on invoices (bill_number)
    where status != 'cancelled' and is_deleted = false;
create index if not exists invoices_order_idx   on invoices (order_id);
create index if not exists invoices_deleted_idx on invoices (is_deleted);

-- ---------------------------------------------------------------------------
-- 11. repair_jobs
-- ---------------------------------------------------------------------------
create table if not exists repair_jobs (
    id                  text primary key default gen_random_uuid()::text,
    repair_number       text not null unique,   -- REP-0001
    customer_id         text not null references customers(id),
    customer_name       text not null,
    customer_phone      text not null,
    service_type        text not null default 'repair',
    description         text not null default '',
    intake_photo        text not null default '',
    damage_photo        text not null default '',
    after_photo         text not null default '',
    promised_date_ad    date,
    promised_date_bs    text,
    promised_date_bs_np text,
    charge              numeric(12,2) not null default 0,
    paid_amount         numeric(12,2) not null default 0,
    status              text not null default 'received',
    is_deleted          boolean not null default false,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);
create index if not exists repair_jobs_customer_idx on repair_jobs (customer_id);
create index if not exists repair_jobs_status_idx   on repair_jobs (status);

-- ---------------------------------------------------------------------------
-- 12. certificates
-- ---------------------------------------------------------------------------
create table if not exists certificates (
    id                 text primary key default gen_random_uuid()::text,
    certificate_number text not null unique,   -- CERT-2026-0001
    product_id         text,                   -- nullable, no FK (soft-delete safe)
    order_id           text,                   -- nullable
    metal              text not null default 'gold',
    purity             text not null default '24K',
    weight_grams       numeric(10,3) not null,
    weight_tola        numeric(10,4) not null,
    stone_details      text not null default '',
    date_ad            date not null default current_date,
    date_bs            text,
    date_bs_np         text,
    is_deleted         boolean not null default false,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);
create index if not exists certificates_deleted_idx on certificates (is_deleted);

-- ---------------------------------------------------------------------------
-- 13. public_leads
-- ---------------------------------------------------------------------------
create table if not exists public_leads (
    id           text primary key default gen_random_uuid()::text,
    lead_type    text not null default 'custom_order',
    name         text not null,
    phone        text not null,
    item_type    text not null default '',
    metal        text not null default '',
    service_type text not null default '',
    approx_weight text not null default '',
    budget       text not null default '',
    deadline     text not null default '',
    notes        text not null default '',
    photo        text not null default '',
    status       text not null default 'new',
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index if not exists public_leads_status_idx on public_leads (status);

-- ---------------------------------------------------------------------------
-- 14. counters  (sequence emulation for order/repair/cert/product numbers)
-- ---------------------------------------------------------------------------
create table if not exists counters (
    name  text primary key,
    seq   bigint not null default 0
);
insert into counters (name, seq) values
    ('order', 0), ('repair', 0), ('certificate', 0), ('product', 0)
on conflict (name) do nothing;

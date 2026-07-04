# Supabase — Jai Supa Deurali Sun-Chandi Pasal

This directory contains all PostgreSQL migration files and setup notes for
the Supabase data layer.  The FastAPI backend continues to use MongoDB via
`motor` (existing code is untouched); these migrations add a **parallel**
Supabase/PostgreSQL layer that new features will target.

---

## Migration files

| File | What it does |
|---|---|
| `migrations/0001_init.sql` | Creates all 14 tables, indexes, counter seed rows and the singleton `shop_settings` row |
| `migrations/0002_rls.sql` | Enables Row Level Security and adds per-table policies |
| `migrations/0003_storage.sql` | Creates storage buckets (`product-photos`, `bill-scans`, `repair-photos`) and their RLS policies |

---

## Applying migrations

### Option A — Supabase dashboard (recommended for first run)

1. Go to **Project → SQL Editor** in the Supabase dashboard.
2. Paste and run each file **in order**: `0001` → `0002` → `0003`.
3. `0003_storage.sql` uses `storage.buckets` helpers that only work in the
   dashboard SQL editor, not raw psql.

### Option B — Supabase CLI

```bash
# one-time setup
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# run all pending migrations
supabase db push
```

> Skip `0003_storage.sql` when using raw psql — create buckets manually via
> the dashboard instead.

---

## Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in your Supabase
project URL and service-role key before starting the backend.

```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>   # never expose this on the frontend
SUPABASE_ANON_KEY=<anon_key>             # safe to expose in React
```

The **service-role key** bypasses Row Level Security — it is used only by the
FastAPI backend (server-side).  The **anon key** is used by the React frontend
for public-read endpoints (catalogue, daily rates, settings).

---

## Table overview

| Table | Notes |
|---|---|
| `users` | Admin accounts (email + bcrypt hash) |
| `shop_settings` | Singleton row `id = 'shop'`; all 12 editable shop fields |
| `categories` | Jewellery categories |
| `collections` | Design collections / product lines |
| `daily_rates` | One row per calendar day; gold_24k, gold_22k, silver (NPR/tola) |
| `customers` | Name, phone, address; soft-delete |
| `products` | Full product catalogue; `photos jsonb []`; `product_code` unique (JSD-P-xxxx) |
| `orders` | `items jsonb` = frozen price snapshot; `old_gold jsonb` = nullable embedded object |
| `payments` | Advance / final payments linked to an order |
| `invoices` | Issued bills; `customer_snapshot jsonb`; partial-unique `bill_number` (active only) |
| `repair_jobs` | Repair intake; `repair_number` unique (REP-xxxx) |
| `certificates` | Hallmark / purity certificates (CERT-yyyy-xxxx) |
| `public_leads` | Enquiry form submissions from the public website |
| `counters` | Monotonic sequence per entity type (order, repair, certificate, product) |

---

## Design decisions

- **JSONB snapshot fields** (`orders.items`, `orders.old_gold`,
  `invoices.customer_snapshot`, `invoices.items`) freeze the state at
  write-time — modifying a product/customer record never retroactively
  changes historical invoices.
- **BS (Bikram Sambat) date fields** are stored as pre-formatted `text`
  strings alongside AD dates; the conversion happens in `backend/utils.py`
  (`ad_to_bs()`).
- `products.photos` is `jsonb` (array of base64 strings or Storage CDN URLs)
  to keep it schema-compatible with the existing MongoDB layer.
- `counters` table emulates MongoDB's `$inc` counter pattern via
  `UPDATE counters SET seq = seq + 1 WHERE name = $1 RETURNING seq`.
- `invoices.bill_number` uses a **partial unique index** — the same number can
  be reused if a previous invoice was cancelled, matching the MongoDB
  application-level behaviour.

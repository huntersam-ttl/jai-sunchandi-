# Supabase V1 Implementation Checklist — Jai Supa Deurali Sun-Chandi Pasal

Companion to `V1_SUPABASE_REBUILD_PLAN.md`. Work top-to-bottom. Each phase is one or
more branches off `feat/supabase-v1` with small, single-purpose commits and the merge
gate (build passes · tests pass · no lint errors · docs updated). Nothing is pushed or
deployed without explicit approval.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked/needs decision

---

## Phase 0 — Prerequisites (needs user action; do not start S1 until all checked)
- [ ] Plan + this checklist approved.
- [ ] Approve provisioning a new Supabase project (org, region `ap-south-1` Mumbai, name `jai-supa-deurali`). *(billable/outward-facing)*
- [ ] Supabase connector authorized in this workspace (OAuth via interactive session — cannot run here).
- [ ] Confirm branch base: `feat/supabase-v1` off clean `main` (done).

## Phase S1 — Provision + schema
- [ ] Create the Supabase project (record project ref, region, org). Confirm cost first.
- [ ] Capture project secrets into env templates (never commit real values):
      `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_DB_URL` (asyncpg), `SUPABASE_ANON_KEY` (frontend).
- [ ] Author initial SQL migration `supabase/migrations/0001_init.sql`:
  - [ ] `gen_random_uuid()` available (pgcrypto).
  - [ ] Tables: shop_settings, daily_rates, categories, collections, products, customers, orders, order_items, payments, repair_jobs, leads.
  - [ ] Money `numeric(12,2)`; timestamps `timestamptz`; AD dates `date`; BS strings denormalised.
  - [ ] Foreign keys: orders→customers, order_items→orders, payments→orders, payments→customers, repair_jobs→customers.
  - [ ] Unique constraints: products.product_code, orders.order_number, repair_jobs.repair_number, daily_rates.date_ad, categories.name, collections.name.
  - [ ] CHECK constraints on enum-like columns (order status, payment_status, material_status, repair status, lead status, metal, purity).
  - [ ] Sequences for product/order/repair codes.
  - [ ] Indexes: customers.phone, orders(customer_id, status, delivery_date_ad, is_deleted), payments.order_id, products(status, is_deleted), daily_rates.date_ad, leads.status.
  - [ ] Order material fields: material_needed, material_status (default `not_needed`), assigned_to, internal_notes.
  - [ ] payment_status column (maintained on write).
  - [ ] Enable RLS on all tables (deny-by-default) + comment documenting service-role access.
- [ ] Create Storage buckets: product-photos (public), shop (public), repair-photos (private), lead-photos (private) + policies.
- [ ] Seed reference data: default categories, collections, singleton shop_settings row.
- [ ] Verify schema applies cleanly; capture the generated types if using them.

## Phase S2 — Backend data layer (FastAPI ↔ Postgres)
- [ ] Add deps to `backend/requirements.txt`: `sqlalchemy[asyncio]`, `asyncpg`, `supabase` (or `httpx` for admin API), `pyjwt` (already present).
- [ ] `backend/db.py`: async engine + session factory (asyncpg), from `SUPABASE_DB_URL`.
- [ ] `backend/config.py`: extend with Supabase settings + reuse ENVIRONMENT/cookie/CORS helpers.
- [ ] SQLAlchemy models mirroring the schema (or Core tables) per domain.
- [ ] Repositories/services per domain, reusing `utils.py` (compute_price, tola/BS dates, mask_name, safe_regex-equivalent not needed — use parameterised queries).
- [ ] Transactional balance update: writing a payment recomputes advance/remaining/payment_status atomically.
- [ ] Sequence-based code generation (product/order/repair) via Postgres sequences.
- [ ] Health check endpoint hitting the DB.

## Phase S3 — Auth (Supabase Auth)
- [ ] Frontend: add `@supabase/supabase-js`; `lib/supabase.js` client from `REACT_APP_SUPABASE_URL` + anon key.
- [ ] Rework `AuthContext` + `Login` to use supabase-js email/password; store session per supabase-js default; expose access token to axios.
- [ ] `lib/api.js`: attach `Authorization: Bearer <supabase access token>` (refresh-aware).
- [ ] Backend: JWT-verify dependency using `SUPABASE_JWT_SECRET`; admin allowlist check; replace `get_current_admin`.
- [ ] Seed the admin user in Supabase Auth (once; no default password in production).
- [ ] Re-apply CORS allowlist (`ALLOWED_ORIGINS`) + slowapi rate limiting on public/auth endpoints.

## Phase S4 — Storage
- [ ] Frontend upload helper: compress → upload to the right bucket → return URL/path.
- [ ] Wire product photos, repair photos, lead photos, shop logo to Storage (store URLs).
- [ ] Backend validates/records URLs; no base64 persisted.
- [ ] Signed URLs for private buckets (repairs/leads) where needed.

## Phase S5 — Feature parity (V1 scope)
Admin:
- [ ] Products CRUD + live price + website toggles + photos + soft delete.
- [ ] Daily rates entry + history.
- [ ] Customers CRUD + search.
- [ ] Customer khata: orders, payments, repairs, total outstanding.
- [ ] Orders: create (stock/custom), order_items snapshot, old-gold, status workflow, delivery dates.
- [ ] Payments: multiple per order; advance/remaining/payment_status maintained transactionally.
- [ ] Material/task tracking on orders (fields + UI card).
- [ ] Leads inbox: list + status workflow.
- [ ] Repairs management: CRUD, status, promised date, charge, photos.
- [ ] Dashboard reminders: due today · overdue · ready · pending payments · unpaid/partial customers · repairs pending · custom orders in progress · materials to buy/purchased.
- [ ] Settings: shop identity/contact/logo/WhatsApp message + change-password (via Supabase Auth).
- [ ] Manual WhatsApp templates module (6 messages) + buttons on OrderDetail/Repairs (wa.me only).
- [ ] Global search (parameterised SQL).

Public site (reuse, repoint to new API):
- [ ] Home, Rates + history chart, Catalogue (filters), Product detail, Custom-order form, Repair form, Order status (order# + phone), Contact, WhatsApp enquiry.
- [ ] Error boundary re-added.
- [ ] No cart / checkout / payment. No invoices/certificates/verify pages in V1.

## Phase S6 — Tests, docs, deploy
- [ ] Backend unit tests (pricing, BS dates, payment-status derivation) — server-less.
- [ ] Backend integration tests against a Supabase test schema/project.
- [ ] `yarn build` green; lint clean.
- [ ] Update PROJECT_ARCHITECTURE.md, DATABASE_SCHEMA.md, FEATURE_MAP.md; add BACKUP_AND_RECOVERY.md (Supabase backups + Storage).
- [ ] `.env.example` (backend + frontend) updated with Supabase vars.
- [ ] Vercel: two projects (frontend CRA; backend FastAPI adapter) with Supabase env; confirm CORS/domains.
- [ ] Post-deploy smoke tests (catalogue, admin login, refresh keeps login, order/payment/khata, order-status requires order#+phone, dashboard reminders, WhatsApp links).

---

## Guardrails (standing)
- Never commit to `main`; branch per change; small commits; no refactor mixed with feature.
- Merge gate: build + tests + lint + docs.
- Schema changes only via Supabase SQL migrations (versioned).
- Preserve V1 exclusions: no online payment, cart, printable invoices, certificates, paid WhatsApp/SMS APIs.
- Do not provision or deploy without explicit approval.

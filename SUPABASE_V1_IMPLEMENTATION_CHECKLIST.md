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

## Phase S2 — Backend data layer (FastAPI ↔ Postgres)  ✅ COMPLETE (2026-07-04)
- [x] Add deps to `backend/requirements.txt`: `SQLAlchemy==2.0.36`, `asyncpg==0.30.0`, `greenlet==3.1.1`. (`PyJWT` already present for S3 JWT verify; no `supabase` client needed — FastAPI talks to Postgres directly.)
- [x] `backend/db.py`: lazy async engine + session factory + `session_scope`/`get_session` + `check_connection()` + `dispose_engine()`. Import-safe without env.
- [x] `backend/config.py`: Supabase settings (URL/service-role/DB URL/JWT secret) + `ENVIRONMENT`, `ADMIN_EMAIL`, `get_allowed_origins()`, `async_database_url()` (asyncpg URL normaliser), `missing_backend_settings()`.
- [x] SQLAlchemy 2.0 models for all 14 tables (`backend/models.py`).
- [x] Async repositories per domain (`backend/repositories/`): settings, reference (categories/collections), rates, products, customers, orders, payments, repairs, leads, tasks (admin+material), templates — reusing `utils.compute_price` / `ad_to_bs` / tola helpers (no duplication).
- [x] Transactional balance update: `PaymentsRepository.add_payment` + `recompute_balances` update advance/remaining/`payment_status` in the caller's session.
- [x] Sequence-based codes (product/order/repair) — via Postgres sequence defaults from migration 0001; models rely on DB defaults.
- [~] Health-check **helper** done (`db.check_connection()`); a health-check **route** is deferred to S3+ (no routes wired in S2 by design).
- [x] Tests: `backend/tests/test_data_layer.py` — config loads safely, no backend secrets in frontend, DB helper importable (no engine created), repositories importable, payment-status derivation, existing Mongo backend still compiles. **10 passed.**

> Pending for S3: real secrets in `backend/.env` (service-role key, DB URL, JWT secret) to exercise `check_connection()` against the live DB; Supabase Auth JWT verification; wiring routes.

## Phase S3 — Auth (Supabase Auth)  ✅ COMPLETE (2026-07-04, auth wiring + health route)
- [x] Frontend: add `@supabase/supabase-js`; `lib/supabaseClient.js` from `REACT_APP_SUPABASE_URL` + anon key (null-guarded; anon key only).
- [x] Rework `AuthContext` to use supabase-js email/password (getSession + onAuthStateChange + signInWithPassword + signOut). `Login` unchanged (uses useAuth().login).
- [x] `lib/api.js`: attach `Authorization: Bearer <supabase access token>` from the live session (refresh-aware); removed localStorage token + cookies.
- [x] Backend: `supabase_auth.py` — verify Supabase HS256 JWT via `SUPABASE_JWT_SECRET` + `ADMIN_EMAIL` allowlist; new `get_current_admin` (legacy Mongo `auth.py` untouched).
- [x] Minimal Supabase app `app.py`: `/api/health`, `/api/health/supabase` (db.check_connection), `/api/admin/whoami` (protected); CORS allowlist re-applied via `config.get_allowed_origins()`.
- [ ] Seed the admin user in Supabase Auth — pending (create the admin user in the Supabase dashboard / Auth API; needs a chosen password).
- [~] slowapi rate limiting — deferred to when public/auth business routes are wired (S5); CORS allowlist is applied now.

> S3 verification: py_compile + 12 backend tests pass; frontend `yarn build` "Compiled successfully"; no service-role/DB-URL refs in frontend. **Live DB connection via `/api/health/supabase` NOT yet exercised** — needs real `SUPABASE_DB_URL` + service-role key in `backend/.env` (not available locally; no secrets committed).

## Phase S4 — Storage
- [x] Frontend upload helper (`frontend/src/lib/storage.js`): compress (reuses `compressImage`) → upload via supabase-js (anon key) → return public URL (public buckets) or stored path (private buckets). Helpers: `uploadImage`, `getPublicUrl`, `getSignedUrl`, `removeImage`; `STORAGE_BUCKETS` map (product/shop public, repair/lead private).
- [ ] Wire product photos, repair photos, lead photos, shop logo to Storage in the forms (deferred to S5 — no route/form wiring in S4).
- [ ] Backend validates/records URLs; no base64 persisted (S5).
- [x] Signed URLs for private buckets available via `getSignedUrl` (used from admin at display time).
- [ ] **Policy needed (S5):** add anon INSERT policy on `repair-photos`/`lead-photos` so the public repair/enquiry forms can upload (write-only; no anon read) — OR route those uploads through the backend (service role). Migration 0001 currently allows only `authenticated` to write to buckets.

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

### S5A — Public read routes  ✅ (2026-07-05)
- [x] Backend public read routes on the Supabase app (`backend/public_routes.py`, included in `app.py`): `/api/rates/today`, `/api/rates/history`, `/api/categories`, `/api/collections`, `/api/products`, `/api/products/{id_or_code}`, `/api/settings`. Use the SQLAlchemy repos; return public-safe fields matching the legacy Mongo contracts (estimated price via `compute_price`; `logo_url`→`logo`). Fixed a repo bug (rates history compared DATE column to a string).
- [x] Public pages read these routes unchanged (contract match — no frontend edits needed): Home, Rates + history chart, Catalogue (filters), Product detail, Contact/About (settings).

### S5B — Public writes + order status  ✅ (2026-07-05)
- [x] `POST /api/leads` (custom-order + repair enquiries; legacy contract) and `GET /api/public/order-status` (order# + phone required; minimal fields, no balance) in `public_routes.py`.
- [x] `OrdersRepository.public_status(order_number, phone)`.
- [x] Storage for public photos = **anon INSERT-only** policy on `lead-photos`/`repair-photos` (migration `0004`; write-only, no anon read; 5MB + image-MIME limits). Repair form uploads via the S4 helper and stores the private **path** (admin views via signed URL).
- [x] Frontend: `Repair.js` (photo → Storage path, no base64), `OrderStatus.js` (order# + phone). `CustomOrder.js` unchanged (contract match).
- [ ] Rate limiting on public writes (`/leads`, `/public/order-status`, login) — deferred to S6 hardening.
- [ ] Error boundary re-added (deferred).
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

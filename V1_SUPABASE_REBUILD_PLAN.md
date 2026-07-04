# V1 Supabase Rebuild Plan — Jai Supa Deurali Sun-Chandi Pasal

**Decision:** Rebuild V1 on a Supabase-first stack (approved). Greenfield — no data migration.
**Backend approach:** FastAPI + Supabase (keep FastAPI as the API layer; Supabase provides Postgres, Auth, and Storage). Reuse the tested pricing engine, khata/ledger logic, and Nepali BS-date helpers.
**DB access:** SQLAlchemy 2.0 async + asyncpg.

This document is the reference plan. The step-by-step task list lives in
`SUPABASE_V1_IMPLEMENTATION_CHECKLIST.md`.

---

## 1. Scope

### In V1
products · categories · collections · daily rates · customers · orders · order items ·
payments · khata / outstanding balances · leads inbox · repairs management ·
material/task tracking · dashboard reminders · manual WhatsApp wa.me templates · settings ·
public site (catalogue, product detail, custom-order form, repair form, contact, WhatsApp enquiry).

### Out of V1 (deferred / excluded)
online payment · cart / checkout · official receipt replacement · printable invoices ·
certificates · paid WhatsApp Business API · SMS API.

> Invoices and certificates are **deferred to V2** — their tables are not created in V1.

---

## 2. Target architecture

```
React frontend (UI reused ~as-is)
 ├─ supabase-js  → Supabase Auth (admin login) + direct Storage uploads
 └─ axios        → FastAPI (all business/data operations)
                      Authorization: Bearer <supabase access token>
FastAPI (adapted; business logic reused)
 ├─ verifies Supabase JWT (project JWT secret) on admin routes
 ├─ Postgres via SQLAlchemy 2.0 async + asyncpg (service-role connection)
 ├─ reuses pricing/BS-date/masking/regex-escape helpers (utils.py)
 └─ Supabase Storage for images (stores URLs, not base64)
Supabase project (new)
 ├─ Postgres  (tables, FKs, CHECK/UNIQUE constraints, indexes, RLS)
 ├─ Auth      (single admin user)
 └─ Storage   (buckets: product-photos, repair-photos, lead-photos, shop)
```

**Data boundary:** the frontend never queries Postgres directly for business data.
FastAPI mediates everything using the **service-role** key so pricing and khata stay
server-side. supabase-js on the client is used only for **Auth** and **image uploads**.
RLS is enabled on every table as a deny-by-default backstop.

---

## 3. Postgres schema (V1 tables)

All PKs `uuid default gen_random_uuid()`. Money as `numeric(12,2)`. Timestamps `timestamptz`.
BS date strings stored denormalised for display (computed at write via the BS-date helper);
AD dates stored as `date`.

| Table | Key columns / notes |
|---|---|
| `shop_settings` | single row (enforced); public subset served by API |
| `daily_rates` | `date_ad date UNIQUE`; `gold_24k, gold_22k, silver numeric` |
| `categories` | `name text UNIQUE` |
| `collections` | `name text UNIQUE` |
| `products` | `product_code text UNIQUE` (from sequence); pricing params; `photos text[]` of **Storage URLs**; `show_on_website`, `show_price_on_website`, `is_deleted` |
| `customers` | `name`, `phone` (indexed), `address`, `notes`, `is_deleted` |
| `orders` | FK `customer_id → customers`; `order_number text UNIQUE`; `order_type`; totals `numeric`; `old_gold jsonb` (nullable, read as a unit); `status`; delivery dates; **material fields** (`material_needed`, `material_status`, `assigned_to`, `internal_notes`); **`payment_status`**; `is_deleted` |
| `order_items` | FK `order_id → orders` (**real child table**, not embedded); frozen price-snapshot columns (weight, rate, purity_factor, metal_value, jarti, jyala, costs, discount, total) |
| `payments` | FK `order_id → orders`, `customer_id → customers`; `amount numeric`; `method`; dates |
| `repair_jobs` | FK `customer_id → customers`; `repair_number` (sequence); service_type, status, charge, promised dates, photo URLs |
| `leads` | public intake (custom_order / repair); no FK; `status` |

**Sequences:** `products.product_code` (`JSD-P-####`), `orders.order_number` (`ORD-####`),
`repair_jobs.repair_number` (`REP-####`) via Postgres sequences.

**Deferred (V2, not created now):** `invoices`, `certificates`.

### Relational integrity wins over Mongo
- Money as `numeric` (no float drift) — correct for a ledger.
- Real **foreign keys** + `ON DELETE` rules → no orphan khata rows.
- Order `advance_total` / `remaining_balance` / `payment_status` maintained inside a **DB transaction** on payment write (addresses audit finding DB-1).
- Uniqueness (`product_code`, `order_number`, rate `date_ad`) as DB constraints, not racy app checks.
- `payment_status` derivation: `paid` (remaining ≤ 0) · `partial` (advance > 0 and remaining > 0) · `unpaid` (advance = 0).

### RLS
Enabled on all tables, deny-by-default. FastAPI uses the service-role key (bypasses RLS).
Anon/public reads are served **through FastAPI**, so no direct anon table access is required;
RLS remains as defense-in-depth.

---

## 4. Auth (Supabase Auth)

- Admin logs in via **supabase-js** (email/password) → Supabase session (short-lived access JWT + refresh).
- Frontend sends `Authorization: Bearer <access_token>` to FastAPI.
- FastAPI verifies the JWT with the project JWT secret and checks it is the allowlisted admin. Replaces the custom `get_current_admin`.
- Admin user **seeded once** in Supabase Auth (carry over Phase-1 principle: seed-once, never reset, no default password in production).

**Conscious trade-off:** Supabase's default session storage is `localStorage`, which partially
reverses the Phase-1 cookie-only hardening. Mitigations: short access-token TTL + refresh
rotation, server-side verification on every call, RLS backstop. Acceptable for a single-admin
tool; preserving httpOnly cookies would require cookie-based session storage (SSR) that CRA
does not support cleanly — out of scope for V1.

---

## 5. Storage

- Buckets: `product-photos` (public read), `shop` (public, logo), `repair-photos` & `lead-photos` (private).
- Flow: client compresses (reuse `compressImage`) → uploads to Storage → stores the returned **URL/path** in Postgres via FastAPI. Eliminates base64-in-DB bloat (audit PERF-1) and shrinks catalogue payloads.

---

## 6. Reuse vs. rebuild

**Reused (high):** the entire React UI (pages, components, Tailwind, design, WhatsApp helper);
business logic (`compute_price`, tola/BS-date helpers, name masking, `safe_regex`); FastAPI route
shapes and Pydantic model shapes (adapted to SQL).

**Rebuilt:** data layer (motor/Mongo → SQLAlchemy async/asyncpg/Postgres); auth (custom JWT/cookie
→ Supabase Auth + JWT verification); storage (base64 → Supabase Storage); migrations (Mongo runner
→ Supabase SQL migrations); integration tests (rewritten against Postgres); deploy env.

**Security carry-over (re-applied in the new stack per the checklist):** CORS allowlist via
`ALLOWED_ORIGINS`; rate limiting (slowapi) on public/auth endpoints; input escaping for any
text search (parameterised SQL removes the Mongo `$regex` class entirely); no default admin
password in production; error boundary on the frontend (already on `main`? no — re-add);
transactional balance updates.

---

## 7. Folded-in V1 accounting + notifications

- `payment_status` as a first-class field.
- Order **material/task fields** as real columns.
- **Dashboard reminders**: due today · overdue · ready for pickup · pending payments ·
  unpaid/partial customers · repairs pending · custom orders in progress · materials to buy / purchased.
- **Manual WhatsApp templates** (6 messages: ready for pickup · payment reminder · order received ·
  order delayed · repair ready · custom order update) as a frontend module using wa.me + Settings.
  No automatic sending, no paid API.

---

## 8. Build phases (each = branch(es) + small commits + merge gate)

- **S1** Provision + schema: create Supabase project; author initial SQL migration (tables, FKs, constraints, indexes, RLS, sequences, buckets).
- **S2** Backend data layer: SQLAlchemy/asyncpg setup; config (Supabase DB URL / service key / JWT secret); domain repositories reusing pricing/BS utils.
- **S3** Auth: supabase-js login; FastAPI JWT verification; seed admin.
- **S4** Storage: buckets + client upload + URL persistence.
- **S5** Feature parity (V1 scope): products, rates, customers, orders, order items, payments, khata, leads, repairs + material/dashboard/WhatsApp/settings + public site.
- **S6** Tests + docs + deploy: Postgres integration tests; build; doc refresh; two-project Vercel deploy with Supabase env.

---

## 9. Effort / risk / cost

- **Effort:** ~2–4 weeks to V1 parity (heavy UI + business-logic reuse; the data-layer, auth, and storage rewrites are the bulk). Dropping invoices/certificates trims scope.
- **Risk:** Moderate, lowered by greenfield (no data migration) and reuse. Main risks: auth-model change, re-testing, two-service deploy config.
- **Cost:** Supabase free tier likely sufficient for one shop (watch row/storage/egress limits). Project creation has billing implications — confirmed before provisioning.

---

## 10. Git base

- `main` = clean, known-good docs baseline (`8e7e523`, builds green).
- All Mongo Phase-1 hardening preserved on `hardening/phase1-security` and snapshot `backup/phase1-mongo-hardening`.
- This work proceeds on `feat/supabase-v1`, cut from `main`.
- Nothing pushed; nothing deployed.

---

## 11. Prerequisites before S1 (needs user action)

1. Approve provisioning a new Supabase project (proposed: org = your account, region
   `ap-south-1` Mumbai, name `jai-supa-deurali`). Project creation is billable/outward-facing —
   done only on explicit go.
2. Authorize the Supabase connector in this workspace (OAuth cannot be run in this
   non-interactive session; authorize via claude.ai connector settings or `/mcp` in an
   interactive session).
3. Approve this plan + the implementation checklist.

# DATABASE SCHEMA — Jai Supa Deurali Sun-Chandi Pasal

**Engine:** MongoDB (accessed via `motor` async driver). Single database named by env `DB_NAME`.

**Conventions used throughout:**
- Every document has a string **`id`** (UUID4) that is the application primary key. The native Mongo `_id` (ObjectId) exists but is **always stripped** from API responses (`{"_id": 0}` projection or `clean()`).
- Types below are the effective JSON/BSON types produced by the Pydantic models in `server.py`.
- "Soft delete" = a boolean `is_deleted` flag; records are never physically removed. Public/most admin queries filter `is_deleted: false`.
- Timestamps: `created_at` / `updated_at` are ISO-8601 UTC strings (`datetime.now(timezone.utc).isoformat()`), **not** BSON dates.
- Dates like `date_ad` / `delivery_date_ad` are `YYYY-MM-DD` strings. Their `*_bs*` siblings are Bikram Sambat (Nepali calendar) strings, some in Devanagari numerals (`*_np`).

**Collections:** `users`, `settings`, `counters`, `daily_rates`, `categories`, `collections`, `products`, `customers`, `orders`, `payments`, `invoices`, `repair_jobs`, `certificates`, `public_leads`.

---

## Indexes

Created on startup (`server.py` startup hook):

| Collection | Field | Type | Notes |
|---|---|---|---|
| customers | `phone` | single | Search-by-phone |
| orders | `customer_phone` | single | Public order status lookup |
| invoices | `bill_number` | single | Uniqueness check / search (NOT declared `unique`) |
| products | `product_code` | single | Search / public lookup |

> ⚠ Missing indexes on heavily-queried fields (`orders.status`, `orders.delivery_date_ad`, `orders.is_deleted`, `daily_rates.date_ad`, `payments.order_id`, `payments.payment_date_ad`, `certificates.certificate_number`). See TECH_DEBT.md. The `bill_number` index is **not** a unique index — uniqueness is enforced only in application code.

---

## 1. `users`
**Purpose:** admin account(s) for dashboard login. Single-admin model; seeded on startup.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| email | string | Lowercased on seed & login; logical unique |
| password_hash | string | bcrypt hash; never returned to client |
| name | string | Display name (default "Admin") |
| role | string | "admin" (not otherwise enforced) |
| created_at | string(iso) | |

**Relationships:** referenced by JWT `sub` claim only. No FKs.

---

## 2. `settings`
**Purpose:** singleton shop profile shown on public site, invoices, certificates.

| Field | Type | Constraints / Notes |
|---|---|---|
| _id | string | Fixed literal `"shop"` (the singleton key — unusual: string `_id`, not UUID) |
| shop_name | string | Required on update |
| shop_name_np | string | Nepali (Devanagari) name |
| tagline / tagline_np | string | |
| phone | string | Validated 7–15 digits on update |
| whatsapp | string | Digits + country code; validated 7–15 digits |
| address | string | |
| maps_link | string | Optional Google Maps URL |
| opening_hours | string | |
| logo | string | base64 data URL (compressed ≤400px) |
| default_whatsapp_message | string | Pre-fill text for WhatsApp CTAs |

**Business purpose:** editable via admin Settings; public exposure is a curated safe subset (`GET /settings`). `PUT /admin/settings` triggers a frontend-wide `SettingsContext` reload.

---

## 3. `counters`
**Purpose:** atomic sequence generator for human-readable codes.

| Field | Type | Notes |
|---|---|---|
| _id | string | Sequence name: `product` \| `order` \| `repair` \| `certificate` |
| seq | int | Incremented via `find_one_and_update($inc, upsert)` |

Produces: `JSD-P-0001`, `ORD-0001`, `REP-0001`, `CERT-2026-0001`.

---

## 4. `daily_rates`
**Purpose:** per-day metal rates (per tola). Drives all live pricing. History kept forever.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| date_ad | string(YYYY-MM-DD) | Upsert key (`update_one({date_ad}, upsert)`) — logical unique per day |
| bs_date | string | BS date (ISO-like `YYYY-MM-DD`) |
| bs_date_np | string | BS date, Devanagari numerals |
| bs_date_long_np | string | e.g. "१५ बैशाख २०८२" |
| gold_24k | float | Rate/tola. Used for ALL gold pricing |
| gold_22k | float | Rate/tola. Stored & displayed but ⚠ not used in compute_price |
| silver | float | Rate/tola |
| created_at / updated_at | string(iso) | |

**Relationships:** "today's rate" = latest by `date_ad` desc; consumed by product live pricing and order defaults. Never mutates past order/invoice snapshots.

---

## 5. `categories` / 6. `collections`
**Purpose:** taxonomy for products / catalogue filters. Seeded with defaults on startup; no admin CRUD UI yet.

| Field | Type | Notes |
|---|---|---|
| id | string(uuid) | PK |
| name | string | Upsert key (`$setOnInsert`) — logical unique |
| created_at | string(iso) | |

Seed categories: Rings, Necklaces, Bangles, Earrings, Chains, Bridal Sets, Silver Items, Coins, Custom Orders, Repair/Polish.
Seed collections: Bridal, Daily Wear, Festival, Dashain/Tihar, Wedding Set, Silver.

---

## 7. `products`
**Purpose:** catalogue/stock item with full pricing parameters and website visibility controls.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| product_code | string | `JSD-P-####` from counter; indexed |
| name | string | Required |
| name_np | string | Nepali name (optional) |
| description | string | |
| category | string | Free text matched to `categories.name` |
| collection | string | Free text matched to `collections.name` |
| metal | string | "gold" \| "silver" (default gold) |
| purity | string | "24K"/"22K"/"18K"/"silver" |
| weight_grams | float | **Canonical stored weight** (>0 enforced on create); derived from tola/lal/aana input |
| jarti_percent | float | Wastage/making %, applied to metal value |
| jyala_amount | float | Making charge |
| jyala_type | string | "flat" \| "per_tola" |
| stone_cost / polishing_cost / cutting_cost / worker_charge / other_cost | float | Additive cost components |
| status | string | "available" \| "reserved" \| "sold" \| "inactive" |
| show_on_website | bool | Gate for public catalogue |
| show_price_on_website | bool | Gate for public estimated price |
| photos | string[] | base64 data URLs (canvas-compressed) |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Derived at read time (not stored):** `weight_tola`, `live_price` (admin), `estimated_price` (public) — recomputed from today's rate.

**Relationships:** referenced by `orders.items[].product_id` and (optionally) `certificates.product_id`. Order lifecycle mutates `status` (available→reserved→sold, or back to available on cancel).

---

## 8. `customers`
**Purpose:** customer master + khata (running ledger) anchor.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| name | string | Required |
| phone | string | Required; indexed; not enforced-unique |
| address | string | Optional |
| notes | string | Optional |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Relationships:** 1:N → `orders`, `payments`, `repair_jobs`. Profile endpoint aggregates these + `total_outstanding` (sum of non-cancelled order remaining balances).

---

## 9. `orders`
**Purpose:** the digital order book. Freezes a price snapshot; source of truth for balances.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| order_number | string | `ORD-####` from counter |
| customer_id | string(uuid) | → customers.id (validated on create) |
| customer_name / customer_phone | string | Denormalized snapshot |
| order_type | string | "purchase" \| "custom_order" \| "repair" |
| items | array[object] | **Embedded frozen line items** (see below) |
| custom_description | string | For custom/repair orders |
| reference_photo | string | base64 (optional) |
| order_date_ad | string | Set to creation day |
| order_date_bs / order_date_bs_np | string | BS variants |
| delivery_date_ad | string\|null | Optional |
| delivery_date_bs / delivery_date_bs_np | string\|null | Computed if delivery date given |
| delivery_time | string | Free text (e.g. "3pm") |
| status | string | new \| in_progress \| making \| polishing \| ready \| delivered \| cancelled |
| notes | string | |
| old_gold | object\|null | Embedded exchange block (see below) |
| total_price | float | Sum of item totals (frozen) |
| old_gold_value | float | Deducted exchange value |
| net_payable | float | total_price − old_gold_value |
| advance_total | float | Recomputed from payments |
| remaining_balance | float | net_payable − advance_total |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Embedded `items[]` object** (frozen output of `compute_price`, plus):
`id`, `product_id` (nullable), `name`, `metal`, `weight_grams`, `weight_tola`, `rate_per_tola`, `purity`, `purity_factor`, `metal_value`, `jarti_percent`, `jarti_amount`, `jyala_type`, `jyala_input`, `jyala_amount`, `stone_cost`, `polishing_cost`, `cutting_cost`, `worker_charge`, `other_cost`, `discount`, `total_price`.

**Embedded `old_gold` object:** `old_item_description`, `old_weight_tola`, `old_valuation_rate_per_tola`, `old_deduction_percent`, `old_weight_grams` (derived), `old_gold_value` (derived: `tola × rate × (1 − deduction%)`).

**Relationships:** N:1 → customers; 1:N → payments; 1:(0..1) → invoices; items may reference products.

---

## 10. `payments`
**Purpose:** individual payments against an order (khata installments).

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| order_id | string(uuid) | → orders.id |
| customer_id | string(uuid) | → customers.id (copied from order) |
| amount | float | |
| payment_date_ad | string(YYYY-MM-DD) | Defaults to today |
| payment_date_bs / payment_date_bs_np | string | BS variants |
| method | string | cash \| bank \| wallet \| other |
| note | string | |
| created_at | string(iso) | |

**Relationships:** N:1 → orders and customers. Adding a payment recomputes the parent order's `advance_total`/`remaining_balance`.

---

## 11. `invoices`
**Purpose:** digital archive of the official stamped paper bill. Frozen copy of an order.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| bill_number | string | **Unique** (enforced in app, indexed); matches physical bill book |
| order_id | string(uuid) | → orders.id |
| order_number | string | Denormalized |
| invoice_date_ad | string | Defaults to today |
| invoice_date_bs / _bs_np / _bs_long_np | string | BS variants |
| customer | object | Frozen `{name, phone, address}` |
| items | array[object] | Frozen copy of order.items |
| old_gold | object\|null | Frozen copy |
| total_price / old_gold_value / net_payable | float | Frozen totals |
| advance_paid | float | Snapshot of order.advance_total AT creation (⚠ not updated later) |
| remaining_balance | float | Snapshot AT creation (⚠ goes stale vs order) |
| status | string | active \| refunded \| exchanged \| cancelled |
| physical_bill_photo | string | base64 scan (⚠ not persisted via any endpoint after create) |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Uniqueness rule:** a new invoice is rejected if a non-cancelled invoice already uses that `bill_number`.

**Relationships:** N:1 → orders. Public verification (`/verify/invoice/{id|bill_number}`) exposes a masked subset.

---

## 12. `repair_jobs`
**Purpose:** repair / polish / cleaning intake and tracking.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| repair_number | string | `REP-####` from counter |
| customer_id | string(uuid) | → customers.id (validated) |
| customer_name / customer_phone | string | Denormalized |
| service_type | string | repair \| polish \| cleaning |
| description | string | |
| intake_photo / damage_photo / after_photo | string | base64 (optional) |
| promised_date_ad | string\|null | |
| promised_date_bs / _bs_np | string\|null | BS variants |
| charge | float | |
| paid_amount | float | Initialized 0 (⚠ no payment endpoint updates it) |
| status | string | received \| working \| ready \| delivered \| cancelled |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Relationships:** N:1 → customers (shown in khata profile).

---

## 13. `certificates`
**Purpose:** authenticity certificate with public QR verification.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| certificate_number | string | `CERT-YYYY-####` from counter |
| product_id | string(uuid)\|null | → products.id (optional link) |
| order_id | string(uuid)\|null | → orders.id (optional; not currently populated by UI) |
| metal | string | gold \| silver |
| purity | string | 24K/22K/18K/silver |
| weight_grams | float | |
| weight_tola | float | Derived on create |
| stone_details | string | Free text |
| date_ad | string | Defaults today |
| date_bs / date_bs_np | string | BS variants |
| is_deleted | bool | Soft delete |
| created_at / updated_at | string(iso) | |

**Relationships:** optional → products/orders. Public verify resolves `product_code` if linked.

---

## 14. `public_leads`
**Purpose:** website enquiries (custom order / repair) awaiting admin follow-up.

| Field | Type | Constraints / Notes |
|---|---|---|
| id | string(uuid) | PK |
| lead_type | string | custom_order \| repair |
| name | string | Required |
| phone | string | Required |
| item_type | string | Optional |
| metal | string | Optional |
| service_type | string | Optional (repair leads) |
| approx_weight | string | Optional (free text) |
| budget | string | Optional |
| deadline | string | Optional |
| notes | string | Optional |
| photo | string | base64 (optional) |
| status | string | new \| contacted \| converted \| closed |
| created_at / updated_at | string(iso) | |

**Relationships:** none (standalone). "Convert to order/customer" is a manual, one-click-conversion backlog item (not yet built).

---

## Cross-cutting notes

- **No referential integrity** is enforced by the database; deleting a customer (soft) leaves orders intact by design.
- **Heavy denormalization** (customer name/phone copied onto orders, invoices, repairs) supports fast list rendering and frozen historical accuracy — but means edits to a customer name don't retroactively update past orders/invoices.
- **base64 image storage** inflates document size and every list payload (products/leads/repairs) — flagged for object-storage migration in TECH_DEBT.md.
- **Unbounded reads:** list endpoints use `to_list(500..1000)` with no pagination; fine at shop scale, a scaling ceiling.

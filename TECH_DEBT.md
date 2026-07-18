# TECH DEBT & RISK REGISTER — Jai Supa Deurali Sun-Chandi Pasal

Prepared during initial lead-engineer inspection. **No code has been changed** — this is an assessment. Items are ordered by severity within each section, with concrete file/line references and suggested remediation.

Severity: 🔴 Critical (broken/unsafe now) · 🟠 High · 🟡 Medium · 🔵 Low/polish

---

## 0. ✅ RESOLVED — Ship-blocking bugs (were introduced by commit `e7a71af`)

> **Status:** Fixed. Both files now build; `yarn build` reports "Compiled successfully"
> (241 kB gzip main bundle). A tree-wide scan confirmed no other half-migrated pages remain.
> Detail retained below for history. **Recommended follow-up (separate task):** add a
> `yarn build` gate to CI so this class of regression can't merge again (see §9).

The commit migrated public pages from the static `SHOP` constant (`lib/format.js`) to the dynamic `useSettings()` context, but two files were left in a non-compiling state.

### 0.1 ✅ `Home.js` — duplicate `const` declarations *(fixed)*
`frontend/src/pages/public/Home.js:10-16`

```js
const shop = useSettings();               // line 10
const waLink = (msg) => waLinkFromSettings(shop, msg);  // line 11
const [rate, setRate] = useState(null);
const [collections, setCollections] = useState([]);
const [products, setProducts] = useState([]);
const shop = useSettings();               // line 15  ← duplicate
const waLink = (msg) => waLinkFromSettings(shop, msg);  // line 16 ← duplicate
```
`SyntaxError: Identifier 'shop' has already been declared`. The **landing page fails to build**.
**Fix:** delete the second pair (lines 15-16).

### 0.2 ✅ `ProductDetail.js` — missing imports + redeclared import *(fixed)*
`frontend/src/pages/public/ProductDetail.js:5, 286-287`

```js
import { rs, waLink, SHOP } from "@/lib/format";   // imports waLink + SHOP (SHOP unused)
...
const shop = useSettings();                         // useSettings NOT imported
const waLink = (msg) => waLinkFromSettings(shop, msg); // waLinkFromSettings NOT imported; also redeclares imported waLink
```
Two errors: `useSettings`/`waLinkFromSettings` are undefined, and `const waLink` collides with the imported `waLink`. The **product detail page fails to build/run**.
**Fix:** `import { rs } from "@/lib/format";` and `import { useSettings, waLinkFromSettings } from "@/context/SettingsContext";` then keep the local `shop`/`waLink`.

> These two are the top priority. A production build (`yarn build`) will surface them immediately; recommend adding a build step to CI so this class of regression can't merge.

---

## 1. Security

### 1.1 🟠 Token stored in `localStorage` defeats the httpOnly cookie
`frontend/src/context/AuthContext.js:16`, `lib/api.js:9-11`, `backend/server.py:260-261`
The backend sets a proper `httpOnly` cookie **and** returns the JWT in the JSON body; the frontend stores it in `localStorage` and sends it as a Bearer header. Storing JWTs in `localStorage` makes them exfiltratable by any XSS, negating the httpOnly protection. **Fix:** pick one model — prefer cookie-only auth (drop the Bearer/localStorage path), or if Bearer is required for the API, don't also set an httpOnly cookie and be explicit about the trade-off.

### 1.2 🟠 Admin password re-synced from env on every startup
`backend/server.py:812, 818-819`
```py
admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
...
elif not verify_password(admin_password, existing["password_hash"]):
    await db.users.update_one(..., {"$set": {"password_hash": hash_password(admin_password)}})
```
If `ADMIN_PASSWORD` is unset, the admin password is **reset to `admin123` on every boot**, and any password the user set is silently overwritten. There is also no in-app password-change flow. **Fix:** seed only when the user is absent; never overwrite an existing hash; add a change-password endpoint; fail fast if `ADMIN_PASSWORD` is a default in production.

### 1.3 🟠 CORS `allow_origins='*'` with `allow_credentials=True`
`backend/server.py:848-853`
This combination is invalid per the CORS spec (browsers reject credentialed `*`) and is over-permissive. Combined with `SameSite=None; Secure` cookies it's fragile. **Fix:** require an explicit `CORS_ORIGINS` allowlist in production; never default to `*` when credentials are enabled.

### 1.4 🟠 Public data enumeration on verify & order-status endpoints
- `GET /verify/invoice/{bill_number}` and `GET /verify/certificate/{certificate_number}` accept the **human, sequential** identifier (`bill_number`, `CERT-2026-0001`). An attacker can enumerate all bills/certs and harvest totals, dates, statuses, and partially-masked names. (`server.py:575-587, 643-658`)
- `GET /public/order-status?phone=` returns order status **and remaining balance** for any phone number with no verification — a privacy leak / enumeration vector. (`server.py:721-729`)
**Fix:** verify by opaque UUID only (QR already encodes `id`); rate-limit; consider a second factor (e.g. last 4 of phone) for order-status, and avoid returning financial balances publicly.

### 1.5 🟡 No rate limiting / spam protection on public writes
`POST /leads` (`server.py:701`) and order-status are unauthenticated and unthrottled — open to spam/scraping. **Fix:** add rate limiting (e.g. slowapi), basic bot mitigation (honeypot/captcha) on lead forms.

### 1.6 🟡 `JWT_SECRET` has no length/strength guard; `HS256` shared secret
`auth.py:21,34` reads `os.environ["JWT_SECRET"]` directly (hard crash if missing, which is acceptable) but nothing enforces entropy. **Fix:** validate a minimum secret length at startup; document rotation.

### 1.7 🔵 base64 images accepted without size/content validation
Products/leads/repairs/settings accept arbitrary base64 strings as "photos"/"logo". No max-size or MIME validation server-side (client compresses, but the API trusts input). **Fix:** validate size and decode a magic-byte check server-side; ultimately move to object storage (see §3.1).

---

## 2. Correctness / data-integrity debt

### 2.1 🟠 22K gold rate is captured but never used in pricing
`utils.compute_price` + callers (`server.py:216-220, 235-239`) always price gold as `gold_24k × purity_factor`. Admins separately enter a **`gold_22k`** rate (dashboard + rates page) that is displayed but **never feeds a calculation**. This is a silent business-logic gap: either 22K should price off `gold_22k`, or the field should be removed to avoid confusion. **Decide the intended model and align UI + engine.**

### 2.2 🟠 Invoice financials go stale after creation
`server.py:526-548` snapshots `advance_paid`/`remaining_balance` at invoice creation. Payments added later update the **order** but not the **invoice**, so a printed/re-opened invoice can show a wrong remaining balance. **Fix:** either recompute invoice balances on read from live payments, or make the "frozen" intent explicit in the UI and hide remaining/advance from the archived invoice.

### 2.3 🟠 "Attach bill scan" silently discards the image
`frontend/src/pages/admin/InvoicePrint.js:23-29` compresses the file and sets local state only — there is **no endpoint** to persist `physical_bill_photo` after invoice creation. The toast says "stored with invoice record" but nothing is stored. **Fix:** add `PUT /admin/invoices/{id}` (or a dedicated scan endpoint) and wire it up; correct the misleading toast.

### 2.4 🟡 Repair `paid_amount` is dead
`repair_jobs.paid_amount` is initialized to 0 and never updated (no repair-payment endpoint). Either implement repair payments or drop the field. (`server.py:602`)

### 2.5 🟡 `bill_number` uniqueness enforced only in app code
The DB index on `invoices.bill_number` is **non-unique** (`server.py:843`), and the app check has a race window (two concurrent creates could both pass). **Fix:** create a partial unique index (unique where `status != cancelled`).

### 2.6 🟡 Soft-delete without delete UX in several entities
`is_deleted` exists on customers/orders/repairs but there is no delete endpoint/UI for them (only products have `DELETE`). Dead capability / inconsistent UX. **Fix:** either expose consistent soft-delete actions or remove the unused flags.

### 2.7 🔵 Deprecated FastAPI startup/shutdown events
`@app.on_event("startup"/"shutdown")` (`server.py:809, 857`) is deprecated in favor of lifespan handlers. **Fix:** migrate to `lifespan`.

---

## 3. Performance / scalability

### 3.1 🟠 base64 images stored in and returned from Mongo
Products, leads, repairs, and the shop logo store images as base64 data URLs inside documents. List endpoints (`/admin/products`, `/products`, `/admin/leads`, `/admin/repairs`) return these inline with `to_list(500..1000)`, so catalogue/list payloads balloon with every photo. PRD already flags this. **Fix:** move images to object storage (S3/GCS — `boto3` is already a dependency), store URLs; serve thumbnails for lists.

### 3.2 🟡 No pagination anywhere
Every list uses a hard `to_list(500)`/`to_list(1000)` cap with no skip/limit or cursor. Works at single-shop scale; silently truncates and slows as data grows. **Fix:** add pagination params to list endpoints and infinite-scroll/paged tables.

### 3.3 🟡 Missing indexes on hot query fields
Only 4 indexes are created (§DATABASE_SCHEMA). Frequent filters/sorts are unindexed: `daily_rates.date_ad` (sorted on nearly every request), `orders.status` / `orders.delivery_date_ad` / `orders.is_deleted`, `payments.order_id` / `payments.payment_date_ad`, `products.status` / `products.is_deleted`, `certificates.certificate_number`. **Fix:** add compound indexes matching the common query shapes.

### 3.4 🟡 Dashboard/report queries fetch full docs to count/sum in Python
e.g. `dashboard` and `reports` pull documents with `to_list(...)` then sum in Python (`server.py:742-748, 766-774`). **Fix:** use MongoDB aggregation (`$group`/`count_documents`) to avoid transferring rows.

### 3.5 🔵 Live price recomputed per product per request
`enrich_product_price`/`product_public_view` recompute `compute_price` for every product on every list call. Cheap now; cache today's-rate-derived prices if catalogue grows.

---

## 4. Duplicated code

### 4.1 🟠 Shop identity defined in FOUR places
Defaults for shop name/phone/whatsapp/etc. are duplicated across:
- `backend/server.py` `SettingsBody` defaults (177-189) **and** `DEFAULT_SETTINGS` (821-833) — two copies in one file
- `frontend/src/context/SettingsContext.js` `SHOP_DEFAULTS` (5-17)
- `frontend/src/lib/format.js` legacy `SHOP` (1-9) — now partially superseded but still imported by `ProductDetail.js`
**Fix:** single backend source of truth; frontend reads from `/settings`; delete the legacy `SHOP` constant and its usages once pages are migrated (relates to §0.2).

### 4.2 🟠 Pricing formula re-implemented in JS twice
`Products.js:104-109` (`preview`) and `Orders.js:86-92` (`itemTotal`) reimplement `compute_price` client-side, independently, and can drift from the backend. **Fix:** extract one shared JS `computePrice()` in `lib/` mirroring `utils.py`, add a test that pins the two implementations together (or fetch the calc from `/admin/calculate-price`).

### 4.3 🟡 Constant/list duplication
- `ORDER_STATUSES` defined in both `Orders.js:9` and `OrderDetail.js:9`.
- Purity option lists (`["24K","22K","18K","silver"]`) hardcoded in several forms.
- `np()` currency-in-Devanagari helper redefined in `InvoicePrint.js:10` instead of reusing `rsNp` from `format.js`.
- Weight/purity constants exist in both `utils.py` and `format.js` (acceptable cross-language, but keep in sync deliberately).
**Fix:** centralize enums/option lists in a shared constants module per side.

### 4.4 🔵 Modal + form scaffolding repeated across admin pages
Products/Orders/Customers/Repairs/Certificates each hand-roll the same fixed-overlay modal shell and file-upload handler. **Fix:** a shared `<Modal>` and `usePhotoUpload` hook.

---

## 5. Unnecessary complexity / unused surface

### 5.1 🟡 Large unused dependency surface
`package.json` includes many libraries the app code doesn't use: `@tanstack/react-query`, `swr`, `react-hook-form`, `@hookform/resolvers`, `zod`, `framer-motion`, `date-fns`, `dayjs`, `lodash`, `embla-carousel`, plus ~45 `components/ui/*` shadcn wrappers largely unreferenced by pages. Backend `requirements.txt` ships `stripe`, `boto3`, `google-genai`, `openai`, `litellm`, `pandas`, etc. that the app never imports. This inflates install size, build time, and audit surface. **Fix:** prune to what's used (keep object-storage/boto3 if §3.1 is planned); tree-shake the UI kit.

### 5.2 🟡 Data fetching is manual `useState`+axios everywhere
No caching, dedup, or loading/error conventions despite `react-query`/`swr` being installed. Leads to repeated boilerplate and no request dedup. **Fix:** adopt one data layer (react-query is already present) for admin lists/detail.

### 5.3 🔵 Craco scaffolding
`craco.config.js` carries build wiring, and `test_result.md` is an agent-protocol file. Fine to keep, but document that these are platform scaffolding, not app logic.

---

## 6. Naming & readability

- 🟡 **`server.py` variable-name terseness:** single-letter locals (`p`, `it`, `og`, `c`, `s`, `w`) throughout make the monolith harder to read. Acceptable in tight scopes, but the pricing/order sections would benefit from fuller names.
- 🟡 **`collections` name clash:** the Mongo `collections` collection shadows the general "collections" concept and is easy to confuse with Mongo collections. Consider `product_collections`.
- 🔵 **`clean()` vs projection `{"_id":0}`** are used inconsistently for the same purpose. Standardize.
- 🔵 **`RatesAdmin` component exported from `Rates.js`** while public `Rates` is a different file — fine, but the duplicated file name across `admin/`+`public/` (`Rates.js`, plus `Repair(s)`, `Order*`) invites import mistakes.

---

## 7. Files that should be split

### 7.1 🟠 `backend/server.py` (859 lines) is a monolith
It holds env/DB wiring, **all** Pydantic models, **all** route handlers, helpers, seeding, and app assembly. **Fix (suggested layout):**
```
backend/
  app.py                # FastAPI app, middleware, lifespan, router include
  db.py                 # motor client/db, next_seq, clean()
  models/               # pydantic schemas grouped by domain
  routers/              # auth, rates, products, customers, orders, payments,
                        # invoices, repairs, certificates, settings, leads,
                        # public, dashboard
  services/             # pricing, seeding, bs-dates (wrap utils.py)
```
This also unlocks per-router testing and reduces merge conflicts.

### 7.2 🟡 `Products.js` (229 lines) and `Orders.js` (206 lines)
Each mixes a list page + a large form/modal + pricing preview in one file. **Fix:** split `ProductForm`/`QrModal` and `OrderForm` into their own components; extract the shared pricing preview.

---

## 8. Components that should be reusable

| Repeated pattern | Where | Suggested shared piece |
|---|---|---|
| Fixed-overlay modal shell | Products, Orders, Customers, Repairs, Certificates | `<Modal title onClose>` |
| Photo upload + compress + preview + remove | Products, Repairs, Settings, InvoicePrint, public Repair | `usePhotoUpload()` / `<PhotoInput>` |
| Status `<Badge>` + status `<select>` pair | OrderDetail, Repairs, Leads, InvoicePrint | `<StatusControl statuses value onChange>` |
| Data table shell (thead + empty state + hover rows) | Products, Orders, Invoices, Customers, Repairs, Certificates, Rates | `<DataTable columns rows emptyText>` |
| KPI stat card | Dashboard, Reports | `<StatCard label value>` |
| Client-side price preview | Products form, Orders form | shared `computePrice()` (see §4.2) |
| Public "success" confirmation screen | CustomOrder, Repair | `<LeadSuccess phone>` |
| Verify result card (green/red) | VerifyInvoice, VerifyCertificate | `<VerifyCard>` + `<Row>` |

---

## 9. Testing & CI gaps

- 🟠 **No build gate:** the §0 compile errors would have been caught by `yarn build` in CI. Add lint+build+test to CI on every PR.
- 🟡 **Backend tests are integration-only** and need a live server + Mongo + seeded admin (`conftest.py`). No pure unit tests for `compute_price`/date conversion (the highest-value, easiest-to-unit-test logic). Add fast unit tests for `utils.py`.
- 🟡 **Frontend has `data-testid` scaffolding but no test runner wired** (`craco test` unused; no jest/RTL/Playwright specs in `src`). Decide on a frontend test strategy or remove the dead scaffolding.
- 🔵 **`test_result.md`** is an agent-protocol artifact, not human test docs — keep, but don't mistake it for a real test plan.

---

## Suggested remediation order

1. **§0.1 / §0.2** — fix the two compile-breaking pages; add `yarn build` to CI (§9). *(hours)*
2. **§1.2 / §1.1 / §1.3** — admin-password reset behavior, token storage model, CORS allowlist. *(0.5–1 day)*
3. **§1.4 / §1.5** — lock verify/order-status to UUIDs + rate limiting. *(0.5–1 day)*
4. **§2.2 / §2.3** — invoice balance staleness + persist bill scan. *(0.5 day)*
5. **§4.1 / §4.2** — collapse the 4× shop defaults and the 2× JS pricing formula. *(0.5 day)*
6. **§3.1 / §3.3** — image object storage + indexes (bigger, plan as a milestone).
7. **§7.1** — split `server.py` into routers as a foundation for everything else.
8. **§2.1** — resolve the 22K pricing model with the shop owner (product decision).

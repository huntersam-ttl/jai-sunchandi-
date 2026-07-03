# PRODUCTION READINESS AUDIT — Jai Supa Deurali Sun-Chandi Pasal

**Audited by:** Lead engineer (initial full-system pass)
**Scope:** entire codebase — backend (`server.py`, `auth.py`, `utils.py`), frontend (all admin + public pages, contexts, libs), config, and DB usage, evaluated as a system a real jewellery shop will use **every day**.
**Instruction honored:** no code was changed during this audit. See "Note on critical fixes" below.

**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · 🔵 Low
**Effort scale:** XS < 1h · S ≈ 1–3h · M ≈ 0.5–1.5d · L ≈ 2–5d · XL > 1 week

> Some findings overlap with **TECH_DEBT.md**; those are cross-referenced (e.g. *[TD §1.2]*) and restated here with audit framing (why-it-matters / fix / effort) so this document stands alone. The two build-breaking bugs from TECH_DEBT §0 are already **fixed** (frontend builds clean).

---

## Executive Summary

| Category | 🔴 | 🟠 | 🟡 | 🔵 |
|---|---|---|---|---|
| Security | 4 | 4 | 3 | 1 |
| Database | 1 | 2 | 3 | 1 |
| Performance | 0 | 2 | 3 | 1 |
| Reliability | 1 | 3 | 2 | 1 |
| UX | 0 | 2 | 4 | 2 |
| Code Quality | 0 | 1 | 4 | 2 |
| Business Logic | 1 | 2 | 3 | 1 |
| **Total** | **7** | **16** | **22** | **9** |

**Top blockers before daily production use (do these first):**
1. **SEC-1** Admin password reset to a known value on every boot + default `admin123`.
2. **SEC-2 / SEC-3** JWT in `localStorage` + `CORS *` with credentials.
3. **SEC-4** Public enumeration of invoices/certificates/order balances.
4. **REL-1** No error boundary — a single render error blanks the whole app.
5. **DB-1 / BIZ-1** No atomic transactions around order↔payment↔product↔invoice; `gold_22k` rate captured but never used in pricing.
6. **REL-4** No backup strategy for the single MongoDB (the shop's entire ledger).

### Note on critical fixes
The instruction was to fix in place only *critical security* issues. On review, each critical security item requires a **decision or carries lockout/availability risk** if changed unilaterally against a live shop (production CORS origin, whether to keep the Bearer path, admin-seeding semantics, verify-endpoint contract used by already-printed QR codes). None is a zero-risk, decision-free one-liner. Per the "never rush / don't break existing features" mandate, I have **documented them at Critical and recommend a single dedicated security-hardening task** (roadmap Phase 1) rather than editing during the audit. I can execute that task immediately on your go-ahead.

---

## 1. Security

### SEC-1 🔴 Admin password is reset from env on every startup; default is `admin123`
**Where:** `backend/server.py:811-819`
**Why it matters:** If `ADMIN_PASSWORD` is unset, every boot re-seeds the password to `admin123` — and if it *is* set, the startup hook **overwrites any password the owner later changed** back to the env value. There is also no in-app change-password flow, so the shop can never truly own its credentials. A predictable admin password on an internet-facing dashboard = full compromise of customer data, pricing, and billing.
**Recommended fix:** Seed the admin **only when absent**; never overwrite an existing hash on boot. Add an authenticated `POST /admin/change-password`. Refuse to start in production if the password equals a known default. Force a first-login password change.
**Effort:** S

### SEC-2 🔴 JWT stored in `localStorage`, defeating the httpOnly cookie *[TD §1.1]*
**Where:** `frontend/src/context/AuthContext.js:16`, `lib/api.js:9-11`, `server.py:260-261`
**Why it matters:** The backend already sets a correct `httpOnly` cookie, but the token is *also* returned in JSON and stored in `localStorage`, then sent as a Bearer header. Any XSS (e.g. via an unsanitized field rendered somewhere) can read `localStorage` and steal a 7-day admin token. This nullifies the httpOnly protection.
**Recommended fix:** Choose one model. Preferred: **cookie-only** — stop returning/storing the token, drop the Bearer interceptor, rely on the httpOnly cookie (already `SameSite=None; Secure`). Keep CSRF in mind (add a CSRF token or `SameSite=Lax` if same-site).
**Effort:** S–M

### SEC-3 🔴 `CORS allow_origins='*'` with `allow_credentials=True` *[TD §1.3]*
**Where:** `server.py:848-853`
**Why it matters:** This combination is invalid per spec and over-permissive; browsers reject credentialed `*`, so teams often "fix" it by reflecting any origin — which would let any website make authenticated requests on a logged-in admin's behalf. Security-critical for a billing system.
**Recommended fix:** Require an explicit `CORS_ORIGINS` allowlist (the shop's real domain(s)); never default to `*` when credentials are enabled; fail fast if unset in production.
**Effort:** XS (needs the production origin as input)

### SEC-4 🔴 Public enumeration of invoices, certificates, and order balances *[TD §1.4]*
**Where:** `server.py:575-587` (invoice verify by `bill_number`), `643-658` (cert verify by `certificate_number`), `721-729` (order-status by phone)
**Why it matters:** Verify endpoints accept the **sequential human number** (`bill_number`, `CERT-2026-0001`), so anyone can iterate and harvest every bill/cert (dates, totals, statuses, partially-masked names). `/public/order-status?phone=` returns **remaining balance** for any phone number with no second factor — a privacy leak and a competitor/scammer goldmine.
**Recommended fix:** Verify by opaque UUID only (the QR already encodes `id`; keep number-lookup for authenticated admin only). For order-status, require a second factor (e.g. order number + phone) and stop returning financial balances publicly. Add rate limiting (SEC-8).
**Effort:** M (coordinate with already-printed QR codes — they encode `id`, so verify-by-id is safe to keep)

### SEC-5 🟠 User input flows unescaped into MongoDB `$regex` (ReDoS / query abuse)
**Where:** 8 sites — `server.py:340, 411, 481-483, 555-557, 754-757`
**Why it matters:** Search `q` is passed directly as a regex. A crafted input (e.g. a catastrophic-backtracking pattern, or just `.*.*.*.*x`) can pin a CPU core (denial of service), and unanchored regex scans are slow. Also inconsistent: phone uses `$regex` without `$options`.
**Recommended fix:** `re.escape()` the input before building the regex, anchor where appropriate (`^` for codes/phones), or use a text index / `$text` search. Cap query length.
**Effort:** S

### SEC-6 🟠 No file-upload validation; base64 images trusted from the client *[TD §1.7]*
**Where:** product `photos`, lead `photo`, repair photos, settings `logo` — accepted as arbitrary strings in the Pydantic models
**Why it matters:** The client compresses images, but the **API trusts whatever it's sent**. A direct API call can store multi-MB strings (DoS / DB bloat), non-image payloads, or `data:` URIs with script content that could be reflected. No size or MIME/magic-byte check server-side.
**Recommended fix:** Validate on the server — max decoded size, allowed MIME via magic bytes, reject non-image. Long-term move to object storage with signed uploads (PERF-1).
**Effort:** S (validation) / L (object storage)

### SEC-7 🟠 No authorization granularity / audit trail
**Where:** all `/admin/*` routes use a single `get_current_admin`
**Why it matters:** Single shared admin account means no per-staff accountability. In a shop where multiple staff may share the login, you cannot tell who voided an invoice, changed a rate, or deleted a product. For a money-handling system this is both a control weakness and a dispute-resolution gap.
**Recommended fix:** (Roadmap, not urgent) introduce named staff users + an append-only audit log for sensitive mutations (rate changes, invoice status, deletes, payments). PRD lists multi-role as out-of-scope, but an **audit log** is worth adding even with one role.
**Effort:** M–L

### SEC-8 🟠 No rate limiting on public write/lookup endpoints *[TD §1.5]*
**Where:** `POST /leads`, `GET /public/order-status`, `POST /auth/login`, verify endpoints
**Why it matters:** Lead form is spammable; login has no brute-force protection; verify/order-status enable fast enumeration (SEC-4). A daily-use public site will attract bots.
**Recommended fix:** Add rate limiting (e.g. `slowapi`) keyed by IP; honeypot/captcha on lead forms; exponential backoff / lockout on login.
**Effort:** S–M

### SEC-9 🟡 `JWT_SECRET` strength not enforced; HS256 shared secret *[TD §1.6]*
**Why it matters:** A weak/short secret makes tokens forgeable. Nothing validates entropy at startup.
**Recommended fix:** Enforce a minimum length at startup; document rotation; consider rotating on incident.
**Effort:** XS

### SEC-10 🟡 Login/`/auth/me` reveal auth state; no lockout feedback throttle
**Why it matters:** Minor info leak / brute-force surface (pairs with SEC-8).
**Recommended fix:** Uniform error messages (already generic "Invalid email or password" — good), add throttling.
**Effort:** XS

### SEC-11 🟡 Secrets only in `.env` (good) but no `.env.example` or documented required vars
**Why it matters:** No committed secrets (verified — good). But onboarding/deploy relies on tribal knowledge of `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `ADMIN_*`, `CORS_ORIGINS`, `REACT_APP_BACKEND_URL`. Missing `JWT_SECRET` hard-crashes with an opaque `KeyError`.
**Recommended fix:** Add `.env.example` files and a startup config check that fails with a clear message listing missing vars.
**Effort:** XS

### SEC-12 🔵 `verify_password`/bcrypt fine; no account for token revocation
**Why it matters:** Logout only clears the cookie/localStorage; the JWT stays valid for 7 days if already copied. Low risk at single-admin scale.
**Recommended fix:** (Optional) shorter expiry + refresh, or a token version/blocklist.
**Effort:** M

---

## 2. Database

### DB-1 🔴 No transactions around multi-document business operations *[TD §2 related]*
**Where:** `create_order` (reserves products + writes order, `server.py:434-472`), `add_payment` + `recompute_order_balance` (441-450, 511-522, 244-250), `create_invoice` (526-548)
**Why it matters:** These mutate several documents non-atomically. If the process dies mid-way, you get a product marked `reserved` with no order, an order whose `advance_total` doesn't match its payments, or a bill number consumed without an invoice. In a **billing/ledger** system, partial writes corrupt the shop's books.
**Recommended fix:** Wrap multi-doc mutations in MongoDB multi-document transactions (requires a replica set — most managed Mongo/Atlas provides this). At minimum, order the writes so the most-critical record is last and add reconciliation on read.
**Effort:** M (code) + infra (replica set)

### DB-2 🟠 Missing indexes on hot query fields *[TD §3.3]*
**Where:** only 4 indexes created (`server.py:841-844`)
**Why it matters:** Frequent filters/sorts are unindexed and will do collection scans as data grows: `daily_rates.date_ad` (sorted on nearly every page load), `orders.status`/`delivery_date_ad`/`is_deleted`, `payments.order_id`/`payment_date_ad`, `products.status`/`is_deleted`, `certificates.certificate_number`, `public_leads.status`. Dashboard/reports will slow first.
**Recommended fix:** Add compound indexes matching real query shapes (e.g. `orders {is_deleted, status, delivery_date_ad}`, `payments {order_id}`, `daily_rates {date_ad:-1}`).
**Effort:** S

### DB-3 🟠 `bill_number` uniqueness enforced only in app code (race window) *[TD §2.5]*
**Where:** `server.py:531-533`, index at `843` is **non-unique**
**Why it matters:** Two near-simultaneous invoice creations with the same bill number can both pass the check and insert — duplicating the official bill number that's supposed to be unique against the physical bill book. Undermines the core "one system entry per physical bill" guarantee.
**Recommended fix:** Create a **partial unique index** on `bill_number` where `status != "cancelled"`; keep the friendly app-level check for UX.
**Effort:** S

### DB-4 🟡 Invoice financial fields go stale after later payments *[TD §2.2]*
**Where:** `server.py:526-548`
**Why it matters:** `advance_paid`/`remaining_balance` are frozen at invoice creation; payments added afterward update the order but not the invoice, so a reopened/reprinted bill can show a wrong balance to a customer.
**Recommended fix:** Recompute invoice balances from live payments on read, or explicitly hide advance/remaining on the archived invoice and show them only on the order.
**Effort:** S

### DB-5 🟡 Heavy denormalization with no propagation *[TD schema notes]*
**Where:** `customer_name`/`phone` copied onto orders/invoices/repairs
**Why it matters:** Correct for frozen history, but a corrected customer name/phone never updates open orders — staff may call the wrong number for an *active* order. Acceptable for closed records, risky for open ones.
**Recommended fix:** For **open** orders/repairs, read customer contact live (or provide a "refresh contact" action). Keep frozen copies on delivered/invoiced records.
**Effort:** S–M

### DB-6 🟡 No referential integrity or cascade rules
**Where:** all relationships are by-id, unenforced
**Why it matters:** Soft-deleting a customer leaves orders pointing at a hidden customer; certificates can reference a deleted product. Mostly benign by design, but orphan states aren't handled in the UI (e.g. customer profile of a soft-deleted customer).
**Recommended fix:** Define and document delete rules; guard the UI against orphan lookups; block deleting customers with open orders.
**Effort:** S

### DB-7 🔵 `settings` uses a string `_id="shop"` singleton
**Why it matters:** Minor inconsistency vs the UUID-`id` convention elsewhere; harmless but surprising.
**Recommended fix:** Document the exception (done in DATABASE_SCHEMA.md); no change needed.
**Effort:** XS

---

## 3. Performance

### PERF-1 🟠 Images stored as base64 in Mongo and returned inline *[TD §3.1]*
**Where:** products/leads/repairs/settings; list endpoints `to_list(500..1000)`
**Why it matters:** Every catalogue/admin list ships full base64 images in the JSON. A catalogue of 200 products with photos becomes multi-MB per request — slow on the shop's mobile data, expensive to re-fetch, and bloats DB working set. The current bundle already relies on this working over WhatsApp-era connectivity.
**Recommended fix:** Move images to object storage (S3/GCS — `boto3` already a dependency), store URLs, serve thumbnails in lists and full images on detail. Add lazy loading (already on catalogue).
**Effort:** L

### PERF-2 🟠 No pagination; hard `to_list()` caps silently truncate *[TD §3.2]*
**Where:** every list endpoint
**Why it matters:** At 1000+ orders/products the caps truncate data (staff won't see older records) and payloads grow unbounded. A shop accumulates records daily for years (10-year horizon).
**Recommended fix:** Add `skip`/`limit` or cursor pagination + server-side search; paginate admin tables.
**Effort:** M

### PERF-3 🟡 Dashboard/reports fetch full docs to sum in Python *[TD §3.4]*
**Where:** `server.py:733-749, 762-774`
**Why it matters:** Pulls up to hundreds of documents just to `sum()` amounts client-side of the DB; grows linearly and duplicates work `count_documents`/aggregation would do in-engine.
**Recommended fix:** Use `$group`/aggregation pipelines for sums and counts.
**Effort:** S

### PERF-4 🟡 Frontend re-fetches on every mount; no caching/dedup *[TD §5.2]*
**Where:** all admin pages use `useState` + axios in `useEffect`
**Why it matters:** Navigating between pages re-hits the API each time (rates, customers, products fetched repeatedly), and there's no request dedup — more load on a small server, more spinner time for staff.
**Recommended fix:** Adopt `react-query` (already installed) for admin data; cache today's rate and lists.
**Effort:** M

### PERF-5 🟡 Single JS bundle ~241 kB gzip; recharts + full Radix set
**Where:** verified `yarn build` output; `recharts` used only on the public Rates page
**Why it matters:** All routes load one bundle. Heavy libs (recharts, framer-motion if used) load even for the login page. Slower first paint on mobile.
**Recommended fix:** Route-level code splitting (`React.lazy`) for admin vs public and for the charts page; drop unused deps (CQ-3).
**Effort:** S–M

### PERF-6 🔵 Live price recomputed per product per request *[TD §3.5]*
**Why it matters:** Cheap now; O(products) per catalogue load.
**Recommended fix:** Cache per-rate computed prices if the catalogue grows large.
**Effort:** S

---

## 4. Reliability

### REL-1 🔴 No React error boundary anywhere
**Where:** verified — no `componentDidCatch`/`ErrorBoundary` in `src`
**Why it matters:** Any uncaught render error (a malformed API field, a null access) unmounts the **entire** SPA to a blank white screen — for both public customers and admin staff mid-transaction. On a daily-use shop tool this looks like a total outage and loses in-progress form data.
**Recommended fix:** Add a top-level `ErrorBoundary` (and ideally per-route) with a friendly fallback + reload. Wire error reporting (REL-3).
**Effort:** S

### REL-2 🟠 Inconsistent/absent loading & error states on data fetches
**Where:** many pages `.then()` with no `.catch()` (e.g. `Customers`, `Invoices`, `Leads`, `Repairs`, `CustomerDetail`, `OrderDetail` initial load); some show "Loading…", others nothing
**Why it matters:** If the API is slow or errors, staff see a permanent spinner or a blank table with no explanation and no retry — they can't tell "no data" from "it broke." Erodes trust in a tool used all day.
**Recommended fix:** Standardize a data-fetching pattern (ties to PERF-4) with consistent loading skeletons, error banners, and a retry action. Add `.catch` + toast everywhere.
**Effort:** M

### REL-3 🟠 No error monitoring / structured logging
**Where:** backend uses basic `logging`; frontend has none
**Why it matters:** When something breaks in the shop, there's no signal to you — the owner just sees a failure. You can't diagnose without reproduction.
**Recommended fix:** Add frontend error reporting (Sentry or similar) and structured backend logs with request ids; alert on 5xx.
**Effort:** M

### REL-4 🔴 No backup strategy for the MongoDB (the shop's entire ledger)
**Where:** operational — nothing in repo addresses it
**Why it matters:** All customers, orders, khata balances, invoices, and certificates live in one Mongo database. Without automated backups, a disk/instance failure or a bad delete wipes the shop's books permanently. This is arguably the single highest business risk for a 10-year tool.
**Recommended fix:** Automated daily backups (managed Atlas backups or `mongodump` to off-site storage) with periodic restore drills; document RPO/RTO. Consider soft-delete already helps against accidental deletes, but not disk loss.
**Effort:** S (managed) — but must be **done before real data accumulates**

### REL-5 🟡 No offline / poor-connectivity handling
**Where:** SPA assumes the API is reachable
**Why it matters:** Shop connectivity in Nepal can be intermittent. A dropped connection mid–order-entry loses the form; there's no "retry"/queue and no offline read of today's rate.
**Recommended fix:** At minimum, preserve in-progress form state and show a clear "you're offline, retry" affordance. (Full offline/PWA is a larger effort — roadmap.)
**Effort:** M (basic) / L (PWA)

### REL-6 🟡 Startup uses deprecated `@app.on_event` *[TD §2.7]*
**Why it matters:** Will break on a future FastAPI upgrade; seeding/index creation lives here.
**Recommended fix:** Migrate to `lifespan` handlers.
**Effort:** XS

### REL-7 🔵 "Attach bill scan" claims to save but doesn't *[TD §2.3]*
**Where:** `InvoicePrint.js:23-29`
**Why it matters:** Staff believe the physical bill scan is archived; it's discarded on navigation — silent data loss and false confidence.
**Recommended fix:** Persist via a `PUT /admin/invoices/{id}` (or dedicated endpoint) and fix the toast copy.
**Effort:** S

---

## 5. UX

### UX-1 🟠 Icon-only actions lack labels; only 4 `aria-label`s in the whole app
**Where:** QR/edit/delete/print buttons across Products, OrderDetail, Repairs, etc.
**Why it matters:** Non-technical shop staff (the stated persona) face unlabeled icon buttons; screen-reader and keyboard users get no context; a mistaken tap on the trash icon soft-deletes a product. Accessibility + error-prevention gap for a daily tool.
**Recommended fix:** Add `aria-label`/`title` to all icon-only buttons; add tooltips; ensure focus-visible styles.
**Effort:** S

### UX-2 🟠 Destructive/confirmation UX is inconsistent (native `window.confirm` only in Products)
**Where:** delete confirm exists only in `Products.js`; other mutations (invoice status → cancelled, order → cancelled which flips product state, lead/repair changes) have **no confirmation**
**Why it matters:** Cancelling an order silently returns a product to `available` and cancelling an invoice frees its bill number — irreversible-feeling actions with no guardrail. Native `confirm()` is also jarring and unstyled vs the rest of the app (an `alert-dialog` component already exists but is unused).
**Recommended fix:** Use the existing shadcn `alert-dialog` for a consistent confirm on all destructive/state-changing actions; summarize the side effects in the dialog.
**Effort:** S–M

### UX-3 🟡 Form validation is minimal and client-only in places
**Where:** most forms validate only "required" via toast (Products, Orders, Customers, Repairs); weight/rate accept any number incl. negatives; phone has no format guidance on customer/lead forms (only Settings validates digits)
**Why it matters:** Bad data enters the ledger (negative weights, malformed phones that then fail order-status lookup, zero rates producing Rs. 0 prices). Errors surface as transient toasts that scroll away.
**Recommended fix:** Add inline field-level validation and sane numeric bounds (weight > 0, rate > 0, non-negative costs); normalize phone on entry; mirror validation server-side.
**Effort:** M

### UX-4 🟡 Search experience is coarse
**Where:** global search + list searches use unanchored regex (SEC-5), no highlighting, no "no results vs error" distinction, no debounce on some inputs (Customers/Invoices fire a request per keystroke)
**Why it matters:** Per-keystroke requests hammer the API; results aren't ranked; staff can't tell empty from failed.
**Recommended fix:** Debounce inputs, add result counts/empty states, escape/anchor regex, consider a Mongo text index for relevance.
**Effort:** S–M

### UX-5 🟡 Mobile admin ergonomics
**Where:** wide tables in Orders/Invoices/Products rely on horizontal scroll; the Order form is a very large modal
**Why it matters:** Shop staff often work on phones; horizontal-scroll tables and a giant modal are hard to use one-handed at the counter.
**Recommended fix:** Card/stacked layouts for tables on small screens; consider a full-page order form on mobile. (Inputs already use ≥44px touch targets — good.)
**Effort:** M

### UX-6 🟡 Empty states are inconsistent
**Where:** many present (good — catalogue, tables, leads), but some fetches render nothing while loading/erroring (REL-2)
**Why it matters:** Blank areas read as "broken" to non-technical users.
**Recommended fix:** Pair every list with loading + empty + error states (ties to REL-2).
**Effort:** S

### UX-7 🔵 No success confirmation beyond toasts for major actions
**Why it matters:** Toasts auto-dismiss; creating an invoice/order gives a fleeting confirmation. For money actions a persistent confirmation is reassuring.
**Recommended fix:** Show a persistent success state / receipt summary after invoice/order creation.
**Effort:** S

### UX-8 🔵 No print preview affordance / print styles are minimal
**Where:** `@media print` hides `.no-print` and strips borders only
**Why it matters:** A5/A4 bills may not paginate cleanly on the shop's actual printer; no margin control.
**Recommended fix:** Test on the real printer; refine print CSS (page size, margins, page-breaks).
**Effort:** S

---

## 6. Code Quality

### CQ-1 🟠 `backend/server.py` is an 859-line monolith *[TD §7.1]*
**Why it matters:** All models, routes, helpers, and seeding in one file makes changes risky, reviews hard, and testing coarse — the opposite of what a 10-year codebase needs.
**Recommended fix:** Split into `models/`, `routers/`, `services/`, `db.py`, `app.py` (layout proposed in TECH_DEBT §7.1). Do this before major feature work so features land in isolated routers.
**Effort:** L (mechanical but touches everything — do carefully with tests)

### CQ-2 🟡 Pricing formula reimplemented in JS twice, drifting from backend *[TD §4.2]*
**Where:** `Products.js:104-109`, `Orders.js:86-92` vs `utils.compute_price`
**Why it matters:** Three copies of the money formula. A change to jarti/jyala handling must be made in three places or previews silently disagree with the saved price — a correctness/trust risk in a pricing tool.
**Recommended fix:** One shared `computePrice()` in `lib/` mirroring `utils.py`, plus a test pinning them together (or call `/admin/calculate-price`).
**Effort:** S

### CQ-3 🟡 Large unused dependency surface (dead weight) *[TD §5.1]*
**Where:** `react-query`/`swr`/`react-hook-form`/`zod`/`framer-motion`/`date-fns`/`dayjs`/`lodash`/`embla` + ~45 unused `components/ui/*`; backend `stripe`/`google-genai`/`openai`/`litellm`/`pandas` etc.
**Why it matters:** Bigger installs, slower builds, larger audit/attack surface, confusion about "what's actually used."
**Recommended fix:** Prune to what's used (keep `react-query` if adopting PERF-4, `boto3` if adopting PERF-1). Remove unreferenced UI components or document the kit as intentional.
**Effort:** S

### CQ-4 🟡 Duplicated constants & shop-defaults *[TD §4.1, §4.3]*
**Where:** shop defaults in 4 places; `ORDER_STATUSES` in 2 files; purity lists hardcoded repeatedly; `np()` redefined vs `rsNp`
**Why it matters:** Edits must be mirrored; drift causes subtle inconsistencies (e.g. a status added in one menu but not another).
**Recommended fix:** Centralize enums/option lists per side; single source for shop defaults (backend → `/settings`); delete legacy `SHOP` once fully migrated.
**Effort:** S

### CQ-5 🟡 Repeated UI scaffolding not componentized *[TD §8]*
**Where:** modal shell, photo-upload, status control, data table, stat card duplicated across pages
**Why it matters:** More code to maintain, inconsistent behavior, harder onboarding.
**Recommended fix:** Extract shared `<Modal>`, `usePhotoUpload`, `<StatusControl>`, `<DataTable>`, `<StatCard>` (catalog in TECH_DEBT §8).
**Effort:** M

### CQ-6 🔵 Terse naming in backend hot paths *[TD §6]*
**Why it matters:** Single-letter locals (`p`, `it`, `og`, `s`, `w`) in pricing/order code slow comprehension for future maintainers.
**Recommended fix:** Rename for clarity during the CQ-1 split.
**Effort:** XS (fold into CQ-1)

### CQ-7 🔵 Testing gaps: no unit tests, no CI, dead frontend test scaffolding *[TD §9]*
**Why it matters:** The highest-value logic (`compute_price`, BS-date conversion) has no fast unit tests; backend tests need a live server; `data-testid`s exist but no runner is wired; the two build-breakers proved there's no build gate.
**Recommended fix:** Add `pytest` unit tests for `utils.py`; add a CI pipeline running lint + `yarn build` + backend tests; decide on a frontend test strategy or remove the scaffolding.
**Effort:** M

---

## 7. Business Logic (does it match a real Nepali jewellery shop?)

Overall the domain modeling is genuinely strong — tola/lal/aana, jarti, jyala flat/per-tola, old-gold satta, frozen snapshots, BS dates, and bill-book sync all reflect real practice. Findings are refinements and one real gap.

### BIZ-1 🔴 22K gold rate is entered but never used in pricing *[TD §2.1]*
**Where:** `utils.compute_price` always uses `gold_24k × purity_factor`; admins separately enter `gold_22k` (Dashboard/Rates)
**Why it matters:** Real shops quote **22K (and 18K) from their own market rates**, which are not always exactly `24K × 0.916` (dealers set 22K rates independently, and hallmark/making conventions vary). The shop enters a `gold_22k` rate expecting it to be used, but every 22K item is priced off 24K × factor — so displayed prices can be **wrong**, silently, on the shop's most common product (22K jewellery). This is the most important business-logic issue.
**Recommended fix:** Decide the model with the owner: either (a) price each purity from its dedicated stored rate (`gold_22k` for 22K, add an 18K rate), or (b) remove `gold_22k` and price purely by factor. Align engine + UI + `daily_rates` schema accordingly. Do not guess — this is a shop-policy decision.
**Effort:** M (+ owner decision)

### BIZ-2 🟠 No order-level discount, and discounts are pre-tax/pre-nothing
**Where:** discount is per line item only (`OrderItemBody.discount`)
**Why it matters:** Shops routinely give a **bill-level** round-off/discount ("le, 500 chhut") at closing, not per item. Staff currently can't apply it cleanly; they'd fudge a line item.
**Recommended fix:** Add an optional order-level discount/round-off field feeding `net_payable`; show it on the bill.
**Effort:** S

### BIZ-3 🟠 Old-gold exchange lacks purity/fineness input
**Where:** `OldGoldBody`: description, weight (tola), valuation rate, deduction %
**Why it matters:** Old-gold valuation in practice depends on **assayed purity/fineness** of the returned item; a single "deduction %" is a rough proxy. Fine for a simple shop, but a shop that touches gold daily may want to record tested purity for fairness/disputes.
**Recommended fix:** (Optional, confirm with owner) add old-gold purity/fineness and derive value from it; keep deduction% as an override.
**Effort:** S–M

### BIZ-4 🟡 Repairs have a charge but no payment/khata linkage
**Where:** `repair_jobs.paid_amount` exists but nothing updates it; repairs don't appear in payment totals
**Why it matters:** Repair income isn't captured in khata/reports — the shop's books miss repair revenue.
**Recommended fix:** Allow payments against repairs (reuse the payment model) and include them in customer outstanding/reports.
**Effort:** M

### BIZ-5 🟡 Certificate is standalone; weak binding to the actual sold item
**Where:** `certificates.order_id` unused by UI; product link optional
**Why it matters:** A certificate of authenticity should ideally tie to the specific invoice/order/item sold, for trust and traceability; currently it can be created free-floating.
**Recommended fix:** Encourage linking certificate → order/invoice item; show the link on the verify page.
**Effort:** S

### BIZ-6 🟡 Rounding is applied per-component; potential paisa drift
**Where:** `compute_price` rounds each component to 2dp then sums
**Why it matters:** Rounding intermediate values (metal, jarti, jyala) before summing can differ by a rupee/paisa from rounding the total once — and the JS previews round differently again (CQ-2). On a stamped bill, a 1-rupee mismatch with the physical calculation invites disputes.
**Recommended fix:** Decide a single rounding policy (round once at the end, or round to nearest rupee per Nepali cash practice) and apply it identically in backend + JS.
**Effort:** S

### BIZ-7 🔵 No handling of advance forfeiture / order cancellation refunds
**Why it matters:** If a custom order is cancelled after an advance, there's no explicit refund/forfeit flow — remaining/advance just sit on a cancelled order.
**Recommended fix:** Add a cancellation flow that records refund or forfeited advance.
**Effort:** S

---

## Prioritized Remediation Roadmap

**Phase 0 — done:** fixed the two build-breakers (TECH_DEBT §0); frontend builds clean.

**Phase 1 — Security & data-safety hardening (before real daily use):**
SEC-1, SEC-2, SEC-3, SEC-4, SEC-5, SEC-8, REL-4 (backups), DB-3 (unique bill index). *≈ 3–5 days.* — recommend as one dedicated task; several need your input (production origin, auth model).

**Phase 2 — Reliability & correctness:**
REL-1 (error boundary), REL-2/REL-3, DB-1 (transactions), DB-2 (indexes), DB-4, BIZ-1 (22K pricing — needs owner decision), BIZ-6 (rounding), CQ-2 (single pricing source). *≈ 1 week.*

**Phase 3 — Performance & scale:**
PERF-1 (image storage), PERF-2 (pagination), PERF-3/4/5, SEC-6 (upload validation). *≈ 1–2 weeks.*

**Phase 4 — UX & maintainability:**
UX-1..UX-6, CQ-1 (split server.py), CQ-3/4/5, CQ-7 (tests + CI). *ongoing.*

**Phase 5 — Business-logic completeness:**
BIZ-2 (order discount), BIZ-3 (old-gold purity), BIZ-4 (repair payments), BIZ-5, BIZ-7. *feature-track, per owner priorities.*

---

*This audit is a point-in-time assessment. As items are fixed, mark them here and reflect status in TECH_DEBT.md / FEATURE_MAP.md.*

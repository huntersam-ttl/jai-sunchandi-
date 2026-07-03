# FEATURE MAP — Jai Supa Deurali Sun-Chandi Pasal

Status legend: ✅ Complete · 🟡 Partial / has caveats · ❌ Missing / not built

> ✅ **Resolved:** the two build-breaking regressions from commit `e7a71af "Admin Settings"`
> (Public Home and Public ProductDetail) were fixed and the frontend now builds cleanly
> (`yarn build` → "Compiled successfully"). History retained in **TECH_DEBT.md §0**.

---

## Public Website

| Feature | Status | Notes |
|---|---|---|
| Public layout (header, nav, footer, floating WhatsApp) | ✅ | Shop details from `SettingsContext` |
| Home / landing page | ✅ | Hero, rate widget, collections, new arrivals, trust badges (duplicate-declaration bug fixed) |
| Today's Rate page + 30-day chart | ✅ | recharts line chart; graceful empty state |
| Catalogue with 4 filters (metal/category/collection/availability) | ✅ | URL-param driven; lazy images; empty state |
| Product detail page | ✅ | Photos, specs, estimated price, WhatsApp CTA, QR (missing-import bug fixed) |
| Estimated (live) price on public products | ✅ | Only when `show_price_on_website`; "*confirmed at shop" disclaimer |
| Custom order request form → lead | ✅ | POST /leads; success screen |
| Repair request form (+ photo) → lead | ✅ | Shares Field/inputCls from CustomOrder |
| Order status lookup by phone | ✅ | Active orders + remaining balance; ⚠ no identity check (privacy note in TECH_DEBT) |
| About page | ✅ | Static + shop identity |
| Contact page (phone, address, maps, WhatsApp, hours) | ✅ | Maps embed is a click-through placeholder, not an iframe |
| Public invoice verification (QR) | ✅ | Masked customer name; safe subset |
| Public certificate verification (QR) | ✅ | Full cert details + verified badge |
| WhatsApp deep links (prefilled messages) | ✅ | From settings `default_whatsapp_message` |
| Client-side image compression before upload | ✅ | `compressImage` canvas→base64 |
| SEO (meta tags, sitemap, OG, structured data) | ❌ | CRA default `index.html`; no per-route meta |
| Multi-language toggle (full EN/NP i18n) | ❌ | Nepali is hardcoded snippets + auto numerals/dates, not a locale system |

---

## Admin Dashboard

| Feature | Status | Notes |
|---|---|---|
| Admin login (JWT) | ✅ | Cookie + Bearer; 7-day expiry |
| Route guard / redirect to login | ✅ | `AdminLayout` gates on auth state |
| Sidebar navigation (11 sections) | ✅ | |
| Global cross-entity search | ✅ | Customers/products/orders/invoices with deep links |
| Today view (KPIs + due lists + inline rate entry) | ✅ | |
| Session persistence across reload | ✅ | `/auth/me` rehydrate |
| Logout | ✅ | |
| Password change UI | ❌ | Password only set/reset via env at startup |
| Multi-user / roles / permissions | ❌ | Out of scope per PRD (single admin) |
| Audit log of admin actions | ❌ | None |

---

## Pricing Engine

| Feature | Status | Notes |
|---|---|---|
| Canonical `compute_price` (metal + jarti + jyala + costs − discount) | ✅ | `utils.py` |
| Purity factors (24K/22K/18K/silver) | ✅ | |
| tola/lal/aana ↔ grams conversion | ✅ | 1 tola = 16 aana = 100 lal = 11.664 g |
| Jyala flat vs per-tola | ✅ | |
| Live price recompute against today's rate | ✅ | Products list/detail, public catalogue |
| Frozen price snapshot on orders/invoices | ✅ | Verified by tests; rate changes don't alter history |
| Standalone price calculator endpoint | 🟡 | `POST /admin/calculate-price` exists but has **no admin UI** |
| 22K priced from dedicated `gold_22k` rate | ❌ | Engine uses `gold_24k × 0.916` for all gold; `gold_22k` is captured/displayed but unused in calc (see TECH_DEBT) |
| Single source of truth for the formula | 🟡 | Re-implemented in JS in Products.js & Orders.js previews (drift risk) |

---

## Orders

| Feature | Status | Notes |
|---|---|---|
| Create order (purchase / custom / repair types) | ✅ | |
| Add items from stock (auto-fill pricing params) | ✅ | |
| Add custom line items | ✅ | |
| Live totals in the form | ✅ | |
| Old gold/silver exchange (valuation, deduction, net) | ✅ | |
| Reserve stock product on order | ✅ | status → reserved |
| Delivered → product sold / cancelled → available | ✅ | Automated in status change |
| Order status workflow (7 states) | ✅ | |
| Order detail: items, old gold, payments, summary | ✅ | |
| Order QR (admin deep link) | ✅ | |
| Order-level discount (vs per-item) | 🟡 | Discount is per-item only; no order-level discount field |
| Edit an existing order's items | ❌ | Only status/payments/invoice after creation; no order edit endpoint |
| Delete/void order | 🟡 | `is_deleted` field exists but no delete endpoint/UI |
| Order printable slip with QR | 🟡 | Order page prints via browser; no dedicated slip layout (backlog) |

---

## Customers

| Feature | Status | Notes |
|---|---|---|
| Create / edit customer | ✅ | |
| Search by name / phone | ✅ | |
| Customer profile / khata (orders, payments, repairs) | ✅ | |
| Total outstanding across orders | ✅ | |
| Soft delete | 🟡 | `is_deleted` supported in queries but no delete UI/endpoint |
| Merge duplicate customers | ❌ | |
| Customer-level statement/print | ❌ | |

---

## Billing (Payments & Khata)

| Feature | Status | Notes |
|---|---|---|
| Multiple payments per order | ✅ | |
| Payment methods (cash/bank/wallet/other) | ✅ | |
| Advance/remaining auto-recompute | ✅ | |
| Payment date (AD + auto BS) | ✅ | |
| Khata visible on order + customer profile | ✅ | |
| Edit / delete a payment | ❌ | Append-only; no correction path |
| Repair job payments | ❌ | `paid_amount` field exists but no endpoint updates it |
| Refund tracking | 🟡 | Invoice status `refunded` only; no refund ledger |

---

## Invoices / QR System

| Feature | Status | Notes |
|---|---|---|
| Create invoice from order (bill-number sync) | ✅ | |
| Unique bill number enforcement | 🟡 | Enforced in app code only; DB index is non-unique |
| Frozen invoice line items & totals | ✅ | |
| Bilingual A5/A4 printable bill (Nepali numerals + BS) | ✅ | |
| Invoice status (active/refunded/exchanged/cancelled) | ✅ | |
| Invoice verification QR → public page | ✅ | |
| Certificate creation + `CERT-YYYY-####` | ✅ | |
| Certificate printable + verify QR | ✅ | |
| Product QR tag (print) | ✅ | |
| Order QR (admin) | ✅ | |
| Attach scan of physical bill | 🟡 | UI compresses image but **does not persist** to backend (no PUT endpoint) |
| Invoice advance/remaining stays in sync with later payments | ❌ | Snapshot frozen at creation; goes stale |
| Invoice PDF file export | ❌ | Browser print only (backlog) |

---

## Certificates

| Feature | Status | Notes |
|---|---|---|
| Create certificate (optionally linked to product) | ✅ | |
| Auto number `CERT-YYYY-####` | ✅ | |
| Printable certificate design | ✅ | |
| Public QR verification | ✅ | |
| Link certificate to an order | 🟡 | `order_id` field exists in model but no UI sets it |
| Revoke / invalidate a certificate | ❌ | Only soft delete field; no UI |

---

## Reports

| Feature | Status | Notes |
|---|---|---|
| Today's sales (payments received) | ✅ | |
| Orders due this week | ✅ | |
| Pending payments total & count | ✅ | |
| Stock counts (available/reserved/sold) | ✅ | |
| Profit analysis | ❌ | Explicit v2 backlog |
| Monthly / date-range trends | ❌ | No date filters; snapshots are "today"-centric |
| Export (CSV/Excel/PDF) | ❌ | |
| Charts on admin reports | ❌ | Cards only (chart exists only on public rates page) |

---

## Settings

| Feature | Status | Notes |
|---|---|---|
| Shop identity (name EN/NP, tagline) | ✅ | |
| Contact (phone, whatsapp, address, maps, hours) | ✅ | Phone/WhatsApp digit validation |
| Default WhatsApp message | ✅ | |
| Logo upload (compressed) | ✅ | |
| Live app-wide reload after save | ✅ | `SettingsContext.reload` |
| Public safe-subset endpoint | ✅ | |
| Restore defaults | 🟡 | "Reset" button reloads saved values (test `test_restore_defaults` exists) — not a factory reset |
| Category / collection management UI | ❌ | Seeded only; no admin CRUD |
| Daily-rate reminder/automation | ❌ | Manual entry |
| Backup / export data | ❌ | |

---

## Cross-cutting / Platform

| Feature | Status | Notes |
|---|---|---|
| Nepali BS date auto-generation | ✅ | `nepali-datetime` |
| Devanagari numeral output | ✅ | |
| Soft-delete pattern | ✅ | (delete UI missing in several places) |
| Backend integration test suite (49 tests) | ✅ | Requires live server + Mongo; not unit tests |
| Frontend automated tests | ❌ | Only `data-testid` scaffolding present; no test runner wired |
| CI/CD pipeline | ❌ | |
| Pagination on lists | ❌ | Hard `to_list(500..1000)` caps |
| Object storage for images | ❌ | base64-in-Mongo |
| Error monitoring / logging | 🟡 | Basic Python logging; no Sentry/structured logs |
| Rate limiting / spam protection on public POSTs | ❌ | `/leads`, `/public/order-status` unthrottled |

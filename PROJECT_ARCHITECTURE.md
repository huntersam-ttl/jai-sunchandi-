# PROJECT ARCHITECTURE — Jai Supa Deurali Sun-Chandi Pasal

**A Jewellery Business Operating System (BOS) + public website** for a decades-old Nepali gold/silver shop.

Core principle (from the PRD): *the physical stamped paper bill remains the official document; this system is the digital archive. No physical bill is written without a system entry existing first.*

> **Repo layout note:** In production the app lives under `/app/backend` and `/app/frontend` (paths referenced in the PRD). In this repo the roots are `backend/` and `frontend/`.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER                                    │
│                                                                            │
│   PUBLIC SITE (no login)              ADMIN DASHBOARD (JWT login)          │
│   ┌───────────────────────┐          ┌────────────────────────────────┐   │
│   │ Home / Rates / Catalog │          │ Today / Rates / Products /     │   │
│   │ ProductDetail /        │          │ Customers / Orders / Invoices /│   │
│   │ CustomOrder / Repair / │          │ Repairs / Certificates /       │   │
│   │ OrderStatus / About /  │          │ Leads / Reports / Settings     │   │
│   │ Contact / Verify(Inv,  │          │                                │   │
│   │ Cert)                  │          │ QR generation (qrcode.react)   │   │
│   └───────────┬───────────┘          └───────────────┬────────────────┘   │
│               │  PublicLayout                         │  AdminLayout       │
│               └──────────────┬───────────────────────┘  (auth guard)      │
│                              │                                             │
│           React 19 SPA (CRA + CRACO, react-router-dom v7)                  │
│           Contexts: AuthContext, SettingsContext                          │
│           lib/api.js (axios, baseURL = REACT_APP_BACKEND_URL + /api)       │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │  HTTPS, JSON, credentials: include
                               │  Authorization: Bearer <jwt> (from localStorage)
                               │  + httpOnly cookie access_token
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         FASTAPI BACKEND (server.py)                        │
│   APIRouter(prefix="/api")                                                 │
│                                                                            │
│   Auth (auth.py)        Pricing/Dates (utils.py)      Route handlers       │
│   ┌──────────────┐      ┌────────────────────┐      ┌──────────────────┐   │
│   │ bcrypt hash  │      │ compute_price()    │      │ /auth /admin/*   │   │
│   │ PyJWT HS256  │      │ tola<->grams       │      │ /products /rates │   │
│   │ get_current_ │      │ ad_to_bs (BS date) │      │ /verify /public  │   │
│   │   admin dep  │      │ nepali numerals    │      │ /leads /settings │   │
│   └──────────────┘      └────────────────────┘      └──────────────────┘   │
│                                                                            │
│   Startup: seed admin user, seed shop settings, seed categories/          │
│            collections, create indexes                                    │
└──────────────────────────────┬─────────────────────────────────────────────┘
                               │  motor (async MongoDB driver)
                               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                              MONGODB (db = DB_NAME)                        │
│   users · settings · counters · daily_rates · categories · collections    │
│   products · customers · orders · payments · invoices · repair_jobs        │
│   certificates · public_leads                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### Stack summary

| Layer | Technology |
|---|---|
| Frontend | React 19, react-router-dom 7, TailwindCSS 3, CRA + CRACO, shadcn/ui (Radix) components, lucide-react icons, recharts, qrcode.react, axios, sonner (toasts) |
| Backend | FastAPI 0.110, Uvicorn, Pydantic v2, motor (async MongoDB) |
| Auth | bcrypt (passlib), PyJWT (HS256), httpOnly cookie + Bearer token |
| DB | MongoDB (single database, UUID string `id` primary keys) |
| Nepali locale | `nepali-datetime` (AD→BS conversion), custom Devanagari numeral translation |
| Build/config | CRACO (`@` alias → `src/`), dotenv |

---

## 2. Folder Organization

```
jai-sunchandi-/
├── backend/
│   ├── server.py         # THE monolith: all models, all routes, seeding, app wiring (859 lines)
│   ├── auth.py           # password hashing, JWT create/verify, get_current_admin dependency
│   ├── utils.py          # pricing engine, tola/grams, AD→BS dates, Nepali numerals, name masking
│   ├── requirements.txt  # pinned deps (note: stripe/boto3/google-genai present but unused)
│   ├── pytest.ini
│   └── tests/
│       ├── conftest.py            # base_url + auth fixtures (hits a LIVE backend URL)
│       └── test_backend_api.py    # 49 integration tests
│
├── frontend/
│   ├── craco.config.js   # webpack @ alias, eslint, visual-edits, health-check plugin
│   ├── tailwind.config.js
│   ├── package.json
│   ├── public/index.html
│   └── src/
│       ├── App.js        # BrowserRouter + all route definitions, provider nesting
│       ├── index.js / index.css / App.css   # fonts, CSS vars, .gold-gradient-text, print styles
│       ├── context/
│       │   ├── AuthContext.js       # user state, login/logout, token in localStorage
│       │   └── SettingsContext.js   # shop settings fetch + defaults + WhatsApp link helper
│       ├── lib/
│       │   ├── api.js       # axios instance, Bearer interceptor, apiError() formatter
│       │   ├── format.js    # rs()/rsNp() currency, toNp() numerals, tola conv, compressImage(), STATUS_COLORS, (legacy) SHOP + waLink
│       │   └── utils.js     # cn() classname merge (shadcn)
│       ├── components/
│       │   ├── PublicLayout.js      # public header/footer/nav + floating WhatsApp
│       │   ├── AdminLayout.js       # sidebar nav, auth guard, global search bar
│       │   ├── admin/ui.js          # shared admin primitives: inp, btnPrimary/Gold/Ghost, F, Card, Badge
│       │   └── ui/*.jsx             # ~45 shadcn/ui Radix wrappers (mostly UNUSED by app code)
│       ├── constants/testIds/       # data-testid registries for automated tests
│       ├── hooks/use-toast.js
│       └── pages/
│           ├── public/   # Home, Rates, Catalogue, ProductDetail, CustomOrder, Repair,
│           │             # OrderStatus, About, Contact, VerifyInvoice, VerifyCertificate
│           └── admin/    # Dashboard, Rates, Products, Customers, CustomerDetail, Orders,
│                         # OrderDetail, Invoices, InvoicePrint, Repairs, Certificates,
│                         # Leads, Reports, Settings, Login
│
├── memory/PRD.md         # product requirements + implementation log
├── design_guidelines.json
├── test_result.md        # Local testing-agent protocol/state
└── test_reports/
```

**Design language** (from `design_guidelines.json` + `index.css`):
- Public site: cream `#FDFCF8`, navy `#0F172A`, gold `#D4AF37`, red `#991B1B`; fonts Playfair Display (`.font-serif-display`) + Outfit.
- Admin: light slate `#F8FAFC`, navy sidebar, gold accent; font Manrope (`.font-admin`).

---

## 3. API Endpoint Documentation

Base path: **`/api`** (mounted via `APIRouter(prefix="/api")`). Auth-required endpoints depend on `get_current_admin` (Bearer token or `access_token` cookie).

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | Validate email/password, set httpOnly cookie, return `{id,email,name,token}` |
| POST | `/auth/logout` | public | Clear `access_token` cookie |
| GET | `/auth/me` | admin | Return current admin (used to re-hydrate session) |

### Daily Rates
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/admin/rates` | admin | Upsert a day's rate (gold_24k/22k/silver per tola); auto-computes BS date |
| GET | `/rates/today` | public | Latest rate (sorted by `date_ad` desc) + Nepali-numeral variants |
| GET | `/rates/history?days=30` | public | Rates within last N days, ascending |

### Categories / Collections
| GET | `/categories` | public | Seeded category list |
| GET | `/collections` | public | Seeded collection list |

### Products
| POST | `/admin/products` | admin | Create; assigns `JSD-P-####` code, converts weight→grams, returns with live price |
| GET | `/admin/products?status&metal&q` | admin | List (excludes soft-deleted), enriched with `live_price` |
| GET | `/admin/products/{pid}` | admin | Single product w/ live price |
| PUT | `/admin/products/{pid}` | admin | Full update |
| DELETE | `/admin/products/{pid}` | admin | Soft delete (`is_deleted=true`, `status=inactive`) |
| GET | `/products?metal&category&collection&availability` | public | Catalogue (only `show_on_website`, not sold/inactive), masked to public view |
| GET | `/products/{pid}` | public | Public detail (accepts `id` OR `product_code`) |

### Customers
| POST | `/admin/customers` | admin | Create |
| GET | `/admin/customers?q` | admin | List / search by name or phone |
| PUT | `/admin/customers/{cid}` | admin | Update |
| GET | `/admin/customers/{cid}` | admin | Full khata profile: customer + orders + payments + repairs + `total_outstanding` |

### Orders
| POST | `/admin/orders` | admin | Create order; freezes per-item price snapshots, handles old-gold exchange, reserves stock products |
| GET | `/admin/orders?status&q` | admin | List / search |
| GET | `/admin/orders/{oid}` | admin | Order + embedded payments |
| PATCH | `/admin/orders/{oid}/status` | admin | Change status; `delivered`→product `sold`, `cancelled`→product `available` |

### Payments
| POST | `/admin/orders/{oid}/payments` | admin | Add payment; recomputes `advance_total`/`remaining_balance` |

### Invoices
| POST | `/admin/invoices` | admin | Create from order; requires unique `bill_number`; freezes items + totals |
| GET | `/admin/invoices?q` | admin | Archive list / search |
| GET | `/admin/invoices/{iid}` | admin | Single invoice |
| PATCH | `/admin/invoices/{iid}/status` | admin | active / refunded / exchanged / cancelled |
| GET | `/verify/invoice/{iid}` | **public** | QR verification — accepts `id` OR `bill_number`; returns masked name + total + status |

### Repairs
| POST | `/admin/repairs` | admin | Create; assigns `REP-####`, intake/damage/after photos |
| GET | `/admin/repairs?status` | admin | List |
| PUT | `/admin/repairs/{rid}` | admin | Update |

### Certificates
| POST | `/admin/certificates` | admin | Create; assigns `CERT-YYYY-####` |
| GET | `/admin/certificates` | admin | List |
| GET | `/verify/certificate/{cid}` | **public** | QR verification — accepts `id` OR `certificate_number` |

### Settings
| GET | `/admin/settings` | admin | Full shop settings |
| PUT | `/admin/settings` | admin | Update (validates phone/whatsapp 7–15 digits) |
| GET | `/settings` | public | Safe subset for public rendering |

### Leads (public intake)
| POST | `/leads` | **public** | Custom-order or repair enquiry from website |
| GET | `/admin/leads` | admin | List all leads |
| PATCH | `/admin/leads/{lid}/status` | admin | new / contacted / converted / closed |

### Public order status
| GET | `/public/order-status?phone=` | **public** | Active (non-delivered/cancelled) orders for a phone: number, type, status, delivery BS date, remaining balance |

### Dashboard / Search / Reports
| GET | `/admin/dashboard` | admin | Today's rate, orders due today/week, ready, pending payments, today's sales, counts |
| GET | `/admin/search?q` | admin | Cross-entity search: customers, products, orders, invoices |
| GET | `/admin/reports` | admin | Today's sales, week deliveries, pending totals, stock counts |
| POST | `/admin/calculate-price` | admin | Standalone pricing calculator |

---

## 4. Database Tables & Relationships

See **DATABASE_SCHEMA.md** for full column detail. Relationship overview:

```
users (admin)                         settings (_id="shop", singleton)
counters (_id per sequence)           categories / collections (seed lists)

daily_rates ──(latest used by)──► products.live_price / product_public_view
                                    │
customers ──1:N──► orders ──1:N──► payments
    │                │  │
    │                │  └── items[] (embedded price snapshots)
    │                │  └── old_gold (embedded exchange block)
    │                └──1:1?──► invoices  (invoice freezes a copy of order.items + totals)
    │
    └──1:N──► repair_jobs
    └──1:N──► certificates (via product_id/order_id, optional)

public_leads (standalone intake, no FK; admin converts manually)
```

- **All PKs** are string UUIDs in an `id` field. `_id` (Mongo ObjectId) is stripped from every response via `clean()` / projection `{"_id": 0}`.
- **Relationships are by embedded id references**, not enforced FKs. Denormalized copies are common (e.g. `orders.customer_name/phone`, `invoices.customer{}`).
- **Sequences** (`JSD-P-0001`, `ORD-0001`, `REP-0001`, `CERT-2026-0001`) come from the `counters` collection via `next_seq()` (`find_one_and_update … $inc`).

---

## 5. Authentication Flow

Single-admin model (no multi-user roles; seeded at startup).

```
STARTUP (server.py @app.on_event("startup"))
  ├─ read ADMIN_EMAIL / ADMIN_PASSWORD from env (defaults admin@jsdpasal.com / admin123)
  ├─ if no user → insert users doc with bcrypt hash
  └─ else if env password no longer matches → RESET stored hash to env password
       ⚠ side effect: password is re-synced from env on every boot (see TECH_DEBT.md)

LOGIN (POST /api/auth/login)
  Browser ──{email,password}──►  find user, bcrypt verify
                                 create JWT (sub=user.id, email, exp=+7d, HS256, JWT_SECRET)
                                 Set-Cookie access_token (httpOnly, secure, SameSite=None, 7d)
  Browser ◄──{id,email,name,token}──
  Frontend: AuthContext.login() stores token in localStorage("jsd_token"), sets user state

AUTHENTICATED REQUEST
  axios request interceptor adds  Authorization: Bearer <localStorage jsd_token>
  (cookie also sent because withCredentials:true)
  Backend get_current_admin():
    token = cookie access_token  OR  Authorization Bearer header
    jwt.decode → lookup users by payload.sub → return user (minus password_hash)
    401 on missing/expired/invalid

SESSION REHYDRATE (page load)
  AuthContext: if localStorage has jsd_token → GET /auth/me
     success → user; failure → user=false (redirect to /admin/login via AdminLayout guard)

ROUTE GUARD (AdminLayout.js)
  user === null  → "Loading…"
  user === false → <Navigate to="/admin/login">
  user object    → render admin shell

LOGOUT
  POST /auth/logout (clears cookie) + remove localStorage token + user=false
```

---

## 6. QR System Flow

QR codes are generated **client-side** with `qrcode.react` (`QRCodeSVG`) encoding app URLs. There is no server-side QR image storage.

| QR type | Where generated | Encoded URL | Scanned by / lands on |
|---|---|---|---|
| Product tag | Products.js `QrModal`, ProductDetail.js | `${origin}/product/{id}` | Public product page (printable tag with code/metal/weight) |
| Order slip | OrderDetail.js | `${origin}/admin/orders/{id}` | Admin order page (login required) |
| Invoice verify | InvoicePrint.js (on printed bill) | `${origin}/verify/invoice/{id}` | Public `VerifyInvoice` → `GET /api/verify/invoice/{id}` |
| Certificate verify | Certificates.js print view | `${origin}/verify/certificate/{id}` | Public `VerifyCertificate` → `GET /api/verify/certificate/{id}` |

```
Admin prints bill/cert  ──►  QR embeds verify URL
Customer scans with phone camera  ──►  opens public verify page
Verify page calls public /api/verify/* endpoint
Backend looks up by id OR human number (bill_number / certificate_number)
Returns SAFE fields only (masked customer name, total, status / cert details)
Renders green "verified" card, or red "not found"
```

Verify endpoints deliberately return a **reduced, privacy-masked payload** (e.g. `mask_name("Ram Bahadur")` → `R** B******`). No line-item cost breakdown is exposed publicly.

---

## 7. Pricing Engine Flow

The canonical implementation is `utils.compute_price()` (backend). The formula, per PRD:

```
tola          = weight_grams / 11.664
purity_factor = {24K:1.0, 22K:0.916, 18K:0.75, silver:1.0}[purity]
metal_value   = tola × rate_per_tola × purity_factor
jarti_amount  = metal_value × (jarti_percent / 100)          # wastage/making %
jyala_amount  = jyala_input × tola   (if jyala_type=="per_tola")
                jyala_input          (if flat)                # making charge
total_price   = metal_value + jarti + jyala
                + stone_cost + polishing_cost + cutting_cost
                + worker_charge + other_cost
                − discount
```

Weight input helpers (traditional Nepali units): `1 tola = 16 aana = 100 lal = 11.664 g`.
`tola_lal_aana_to_grams(tola, lal, aana)` and `grams_to_tola(g)` handle conversion; **grams is the stored canonical unit**.

```
WHERE compute_price IS USED (backend):
  • create_product / update_product → live price on save
  • enrich_product_price → admin list/detail "live_price" (recomputed against today's rate)
  • product_public_view → public "estimated_price" (only if show_price_on_website)
  • create_order → per-item FROZEN snapshot stored in orders.items[]
  • POST /admin/calculate-price → standalone calculator

LIVE vs FROZEN:
  Products show LIVE price (today's rate, recomputed each request) — never stored as sale price.
  Orders/Invoices store a FROZEN snapshot at creation time; later rate changes never alter them.
  (test_snapshot_frozen_when_rate_changes verifies this.)
```

> ⚠ **Modeling note:** the engine always prices gold using `rate.gold_24k × purity_factor`, even for 22K/18K, although admins separately enter a `gold_22k` rate. The `gold_22k` field is displayed but not used in computation. Flagged in TECH_DEBT.md.

There are **parallel JS re-implementations** of this formula in `Products.js` (form preview) and `Orders.js` (`itemTotal`) — they must stay in sync with the backend by hand.

---

## 8. Invoice Generation Flow

```
1. Order exists with frozen items + net_payable + advance_total + remaining_balance.
2. Admin, on OrderDetail, enters the PHYSICAL bill book number and clicks "Create".
      POST /api/admin/invoices { order_id, bill_number }
3. Backend:
      - validates order exists
      - rejects duplicate bill_number (unless the existing one is "cancelled")
      - copies customer{name,phone,address}, items[], old_gold, totals into a NEW frozen invoice doc
      - computes invoice_date_bs (Nepali) variants
      - status = "active"
4. Redirect to /admin/invoices/{id} (InvoicePrint).
5. InvoicePrint renders a bilingual A5/A4 bill:
      - shop identity (from SettingsContext), bill no (EN + Nepali numerals), BS + AD dates
      - per-item table (weight tola/gram, purity, rate, jarti, jyala, total) in Devanagari
      - totals: Total → (− old gold) → Net Payable → Advance → Remaining
      - verification QR (→ /verify/invoice/{id})
      - signature/stamp area + "digital archive of stamped paper bill" disclaimer
6. Admin prints (window.print(); .print-area / .no-print CSS). Optional: attach a scan of the
   stamped physical bill.
```

Bill uniqueness = the sync guarantee with the physical bill book. Invoice status transitions: `active → refunded / exchanged / cancelled`.

> ⚠ The invoice freezes `advance_paid` / `remaining_balance` **at creation**; payments added to the order afterward do not update the invoice copy, and the "attach bill scan" upload is not persisted to the backend. See TECH_DEBT.md.

---

## 9. Public Website Flow

Wrapped by `PublicLayout` (sticky glass header, nav, footer, floating WhatsApp button — all shop details from `SettingsContext`).

```
Home (/)            → today's rate widget, featured collections, new arrivals, trust badges
Rates (/rates)      → today's 3 rates + 30-day recharts line chart (/rates/history)
Catalogue           → 4 URL-driven filters (metal/category/collection/availability) → /products
  (/catalogue)         grid of product cards with estimated price* + availability badge
ProductDetail       → photos, specs, live estimated price, WhatsApp enquiry (prefilled),
  (/product/:id)       product QR
CustomOrder         → lead form → POST /leads (lead_type=custom_order) → success screen
Repair (/repair)    → lead form (+ optional photo) → POST /leads (lead_type=repair)
OrderStatus         → enter phone → GET /public/order-status → active orders + remaining balance
About / Contact     → static content pulling shop identity/contact from settings
Verify Invoice/Cert → scan-to-verify public pages (green/red result cards)
```

No customer accounts, cart, or online payment (explicitly out of scope). WhatsApp is the primary CTA everywhere. Images are client-compressed (`compressImage`, canvas→base64) before any upload.

---

## 10. Admin Dashboard Flow

Wrapped by `AdminLayout` (dark sidebar nav, auth guard, sticky global search bar).

```
Login (/admin/login) → AuthContext.login → JWT → /admin

Today (/admin)       → KPIs (today's sales, pending orders, invoices today, new leads)
                       inline "set today's rate" form
                       lists: due today / due this week / ready for collection / pending payments
Daily Rates          → enter rate for any AD date; 90-day history table
Products             → table + modal CRUD; tola/lal/aana↔grams; live price preview;
                       website/price toggles; multi-photo (compressed); QR tag print; soft delete
Customers            → list/search + modal CRUD → CustomerDetail (khata: orders, payments,
                       repairs, total outstanding)
Orders               → list/filter + big "New Order" modal (stock items or custom items,
                       old-gold exchange, live totals) → OrderDetail (status workflow,
                       payments/khata, create-invoice, order QR)
Invoices             → searchable archive → InvoicePrint (bilingual printable bill)
Repairs              → table + modal CRUD (intake/damage/after photos, promised BS date, charge)
Certificates         → table + create modal → printable certificate w/ verify QR
Leads                → website enquiries; status workflow (new→contacted→converted→closed)
Reports              → sales/deliveries/pending/stock summary cards
Settings             → shop identity, contact, WhatsApp message, logo; validated; live-reloads
                       SettingsContext across the whole app
```

Global search (header) hits `/admin/search` and returns grouped customer/product/order/invoice hits with deep links.

State management is intentionally lightweight: **React Context for auth + settings**, and **local component `useState` + direct axios calls** everywhere else (no Redux; `react-query`/`swr` are installed but not used — see TECH_DEBT.md).

---

## 11. Environment & Configuration

Backend (`backend/.env`, not committed — `.gitignore`d):
- `MONGO_URL`, `DB_NAME` — Mongo connection
- `JWT_SECRET` — **required** (no default; server errors without it)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` — seed/reset admin credentials
- `CORS_ORIGINS` — comma list (default `*`)

Frontend (`frontend/.env`):
- `REACT_APP_BACKEND_URL` — API origin (client prefixes `/api`)

Tests (`backend/tests/`) are **integration tests against a running backend URL**, not unit tests — they require a live server + Mongo and the seeded admin.

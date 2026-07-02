# PRD — Jai Supa Deurali Sun-Chandi Pasal (Jewellery Business OS)

## Original Problem Statement
Full-stack Jewellery Business Operating System + public website for a decades-old Nepali gold/silver shop. One system: public customer website, secure admin dashboard, digital order book, pricing calculator, stock/catalogue management, hybrid physical+digital billing archive, QR code system (products/orders/invoices/certificates). Core principle: physical stamped paper bill remains official; system is the digital archive — no physical bill without a system entry first.

## Architecture (implemented)
- **Stack**: React 19 + TailwindCSS frontend, FastAPI backend, MongoDB (motor), JWT single-admin auth (user-approved substitution for Supabase/Vercel stack).
- Backend: `/app/backend/server.py` (all routes, /api prefix), `utils.py` (pricing engine, tola conversion, BS dates via nepali-datetime, Nepali numerals), `auth.py` (bcrypt + PyJWT).
- Frontend: public pages `/app/frontend/src/pages/public/`, admin `/app/frontend/src/pages/admin/`, shared helpers `lib/format.js` (toNp, tola conversions, WhatsApp links, image compression), `lib/api.js`.
- Photos: client-side canvas compression → base64 stored in Mongo.
- QR: client-side `qrcode.react` encoding app URLs (product page, admin order, /verify/invoice/:id, /verify/certificate/:id).
- Admin: admin@jsdpasal.com / admin123 (see /app/memory/test_credentials.md).

## User Personas
- Shop owner/staff (non-technical): admin dashboard, large simple forms.
- Customers: browse catalogue, check rates, WhatsApp enquiry, order status by phone. No accounts.

## Core Requirements (static)
- Pricing: metal_value = tola × rate × purity_factor (24K=1.0, 22K=0.916, 18K=0.75, silver=1); jarti = metal×%; jyala flat/per_tola; + stone/polishing/cutting/worker/other − discount.
- 1 tola = 11.664 g; input tola/lal/aana (1 tola = 16 aana = 100 lal) or grams; grams stored internally.
- Orders/invoices freeze price snapshots; rate changes never alter past records.
- Old gold exchange: old_value = old_tola × val_rate × (1−deduction%); net_payable = total − old_value.
- Bill number entered by admin, unique, matches physical bill book.
- Nepali output auto-generated (numerals + BS dates); admin types English only.
- Soft delete everywhere; public sees only show_on_website & not sold/inactive; no cost/profit data public.

## Implemented (2026-07-02) — MVP complete, all tested (38/38 backend, frontend flows pass)
- JWT admin auth + seeding; daily rates (AD+auto BS, history forever, 30-day public chart)
- Products CRUD: photos (compressed), categories/collections (seeded defaults), tola/lal/aana↔grams, jarti/jyala/costs, statuses, website toggles, live price preview, QR tag print
- Customers + khata profile (orders/payments/repairs/total outstanding)
- Orders: 3 types, frozen snapshots, old gold exchange, reserved→sold/available product automation, BS dates
- Payments: multiple per order, advance/remaining recompute
- Invoices: bill_number sync (unique), frozen line items, printable A5/A4 Nepali bill (numerals, BS date, jarti/jyala/old-gold/signature/QR), status active/refunded/exchanged/cancelled, physical bill scan attach
- Repairs: intake/damage/after photos, statuses, promised BS date, charge
- Certificates + public QR verification page; invoice public verification (masked name)
- Public site: Home, Rates, Catalogue (4 filters), Product Detail (WhatsApp prefilled + QR), Custom Order form, Repair form, Order Status by phone, About, Contact
- Admin Today View (rates entry, due today/week, ready, pending payments, today's sales, global search), Reports (launch scope)

## Backlog / Next
- P1: Convert lead → order/customer in one click; order QR on printable slip; settings page (shop contact/WhatsApp editable — currently constants in lib/format.js)
- P1: Real shop details (WhatsApp number, address, photos) to replace placeholders
- P2: Advanced reports (profit, monthly trends), invoice PDF file generation (currently browser print), thumbnails for catalogue payload size, image object storage migration
- Out of scope (per spec): e-commerce cart, online payments, customer accounts, EMI, multi-shop, roles

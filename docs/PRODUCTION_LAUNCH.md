# Production Launch Checklist

This is the runbook for the first real deployment. It is intentionally manual: no production migration, deployment, Auth enrollment, or shop-data change is authorized by this document.

## Release gates

- [ ] Owner decides the pricing policy for 22K items. The code currently calculates gold from the 24K rate plus a purity factor, while the admin also records a separate 22K rate. Do not quote real 22K prices until that policy is confirmed and tested.
- [ ] Hosted Supabase project is identified and a maintenance window is agreed.
- [ ] Production domain and Vercel project are confirmed.
- [ ] A real admin Auth UUID is recorded securely; never paste a password or service key into this repository.
- [ ] The current PR head has green PostgreSQL, backend, frontend-test, and frontend-build checks.

## Before launch

Record/export, without committing secrets:

- Supabase project ref, region, current migration/schema state, Auth provider settings, Storage bucket settings, and a database backup/snapshot.
- Vercel project, production domain, deployment rollback target, and current environment-variable names.
- Admin Auth user UUID(s) and email(s), shop settings, daily-rate entry process, and the first product-data sheet.
- A copy of the current public settings and any existing product/order counts for post-migration comparison.

## Database and migrations

Apply the tracked files in lexical order, using the Supabase SQL editor or the approved migration runner:

1. `0001_init.sql` through `0013_leads_soft_delete.sql`
2. `0014_admin_membership_rls.sql`
3. Enroll admins using the SQL pattern below.
4. `0015_customer_fulfilment_fields.sql`
5. `0016_secure_fulfilment_workflow.sql`

The GitHub PostgreSQL job bootstraps a disposable database, applies the same ordered chain, and checks required columns, buckets, constraints, and the admin self-read policy. It does not touch hosted Supabase.

### 0014 caution

This migration replaces broad authenticated `admin_all` policies with membership checks. Existing Auth users lose direct Data API/Storage access until enrolled. The FastAPI service-role connection is unaffected.

After applying 0014, run the following with the real Auth UUID(s) substituted locally in the SQL editor. Do not put the UUID in source control if the project treats it as sensitive operational data:

```sql
insert into public.shop_admins (user_id)
values ('AUTH-USER-UUID-HERE')
on conflict (user_id) do nothing;
```

Then verify the admin can log in before continuing.

## Hosted Supabase verification

Confirm these buckets exist and remain configured as follows:

| Bucket | Public | Purpose | Upload policy |
| --- | --- | --- | --- |
| `product-photos` | Yes | Public catalogue images | Enrolled admin only |
| `shop` | Yes | Shop logo/public assets | Enrolled admin only |
| `repair-photos` | No | Customer repair photos | Anonymous insert with restricted path; admin read/proxy |
| `lead-photos` | No | Custom-order reference photos | Anonymous insert with restricted path; admin read/proxy |
| `bill-photos` | No | Admin bill photos | Enrolled admin only |

For all image buckets, confirm the 5 MB limit and JPEG/PNG/WebP MIME allowlist. Confirm anon has no read policy for private buckets and the frontend contains only the anon key.

Smoke test after each stage:

- Auth admin login and `/api/admin/whoami`.
- Public rates, settings, catalogue, product detail, order-status, certificate, and invoice pages.
- Admin product upload, repair-photo access, lead/reference-photo access, and bill-photo access.
- Admin writes for rates, products, orders, payments, order status, pickup PIN, collection, and settings.
- Public order status requires both order number and phone and does not expose payment balances.

## Production environment

| Variable | Side | Required | Secret | Purpose / missing behavior |
| --- | --- | --- | --- | --- |
| `ENVIRONMENT=production` | Backend | Yes | No | Enables production-safe CORS behavior. |
| `SUPABASE_URL` | Backend | Yes | No | Supabase API/JWKS base URL; health reports missing and protected auth fails if absent. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Yes | Yes | Server-only DB/Storage access; never expose to the browser. |
| `SUPABASE_DB_URL` | Backend | Yes | Yes | Server-only async PostgreSQL connection; DB health fails safely if absent. |
| `ADMIN_EMAIL` | Backend | Yes | No | First auth gate for admin routes; unset causes a controlled 500. |
| `ALLOWED_ORIGINS` | Backend | Yes for cross-origin | No | Explicit production browser allowlist; unset denies cross-origin requests. |
| `REACT_APP_BACKEND_URL` | Frontend | Yes unless same-origin rewrite is used | No | Backend origin. Use the Vercel same-origin `/api` arrangement or an explicit HTTPS API origin; never ship localhost. |
| `REACT_APP_SUPABASE_URL` | Frontend | Yes for admin login/uploads | No | Public Supabase URL. Missing leaves admin Auth/storage unavailable. |
| `REACT_APP_SUPABASE_ANON_KEY` | Frontend | Yes for admin login/uploads | No | Public anon key only. Never substitute the service-role key. |
| Shop settings in `shop_settings` | Database | Yes before launch | No | Name, Nepali name, phone, WhatsApp, address, Maps link, hours, logo, messaging. Empty values intentionally hide optional contact UI. |

There is no tracked cron/scheduler configuration or rate-source automation. Daily rates are currently an admin-entered operational task; do not advertise automated publication until one is configured and monitored.

## Real shop data

Populate through Admin → Settings; do not edit source constants for normal shop changes:

- official English/Nepali shop identity and tagline
- phone and WhatsApp numbers
- complete address and Maps link
- opening hours and logo
- confirmed WhatsApp message

Product entry supports name, Nepali name, design code generated by the database, category, collection, purity, weight, cost/making inputs, availability, website/price visibility, description, and gallery photos. The current product model has no separate `customisable` or `featured` fields; use collection membership, description, website visibility, and status until the owner requests a data-model change. Do not bulk-create fake/demo stock.

Product-entry checklist:

- [ ] Add or activate the category and collection first.
- [ ] Enter the weighed grams or tola/lal/aana value; confirm the preview is positive.
- [ ] Enter purity, making/jarti/cost inputs only when confirmed; leave unknown cost blank.
- [ ] Upload clear JPEG/PNG/WebP photos and confirm the primary image is first.
- [ ] Keep `Show on website` off until the record and photos are checked.
- [ ] Verify the public product page, estimated price, collection filter, and WhatsApp enquiry.

No CSV importer is included in this release candidate. One-by-one entry is safer for the first real catalogue because images, weights, and visibility need a human check.

## Customer and admin smoke journeys

Run with test records before launch, then repeat carefully with the first real order:

- Nepal: catalogue → product → rate/enquiry → self-collection → admin order → payment → ready → issue PIN → collect once.
- UK: product → customise → `GB` → authorised collector → collector name/phone → admin review → ready → PIN → successful single collection.
- Custom design: up to five reference images, purity, size, budget, country, fulfilment, and notes appear in Admin → Leads.
- Wrong pickup PIN is rejected; correct PIN collects once; reuse is rejected.
- Two reservations for the same product leave only one successful order.
- Concurrent payments never exceed the order balance.
- Cancellation releases an active reservation according to the tested order workflow.

## Public trust and SEO checks

Before launch, confirm there are no demo products, fake testimonials, placeholder phone/address values, or unsupported claims. The public pages expose rates, purity, weight, estimated pricing, contact/WhatsApp, location when configured, custom orders, repairs, order tracking, and certificate/invoice verification.

The SPA updates titles, canonical, Open Graph, Twitter, and store JSON-LD client-side. The HTML template currently contains the configured `https://www.jaisupadeurali.com/` base URL and logo; verify that this is the intended production domain. No `sitemap.xml` or `robots.txt` is currently tracked, so add those only after the production domain is confirmed.

## Performance and accessibility smoke test

- [ ] Test a Nepal mobile connection: home first paint, rate widget, catalogue, product gallery, and custom-order form.
- [ ] Confirm images use the existing responsive Supabase/Unsplash transformations and uploads remain capped/compressed.
- [ ] Confirm keyboard focus, form labels/errors, gallery buttons, 44px tap targets, contrast, and reduced-motion behavior.
- [ ] Check the production bundle/build report and browser console for failed API or asset requests.

## Rollback

There are no down migrations. If a migration fails, stop, preserve the error and backup, and do not continue partially. Restore the disposable/hosted database snapshot or use a reviewed forward-fix SQL script.

If 0014 causes admin lockout, use the Supabase SQL editor or service-role maintenance connection to insert the verified Auth UUID into `public.shop_admins`, then re-test login and Storage. If a Storage policy breaks uploads, keep private buckets private, pause public forms, restore the known policy from backup/reviewed SQL, and do not make the bucket public as a workaround.

For application rollback, promote the last known-good Vercel deployment and keep the database at the compatible migration level. Do not roll code back across a schema change unless the older code is confirmed compatible with the applied columns and enum values.

## After launch

- [ ] Monitor Vercel function errors, Supabase Auth/Storage logs, database health, and failed public leads.
- [ ] Confirm the daily rate is entered and visible each business day.
- [ ] Verify the first real product, first real order/payment, and first collection end-to-end.
- [ ] Take a fresh backup before the next migration or operational bulk update.

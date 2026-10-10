# Production Launch Checklist

This is the runbook for the first real deployment. It is intentionally manual: no production migration, deployment, Auth enrollment, or shop-data change is authorized by this document.

## Release gates

- [ ] Owner decides the pricing policy for 22K items. The code currently calculates gold from the 24K rate plus a purity factor, while the admin also records a separate 22K rate. Do not quote real 22K prices until that policy is confirmed and tested.
- [ ] Hosted Supabase project is identified and a maintenance window is agreed.
- [ ] Production domain and Vercel project are confirmed.
- [ ] A real admin Auth UUID is recorded securely; never paste a password or service key into this repository.
- [ ] The current PR head has green PostgreSQL, backend, frontend-test, and frontend-build checks.

## Cycle 7 verification record

The current hosted project is active and was inspected read-only as `jai-sunchandi-` (`hzpukedwffyuysvhvlbg`) in `ap-south-1`. Hosted migration history contains 14 timestamped records and stops before repository migrations 0014–0018. Hosted inspection confirmed historical authenticated allow-all policies, four `auth.role()` bypass policies, and excessive `anon`/`authenticated` table grants. The repository now contains corrective migration `0018_harden_admin_membership_privileges.sql` plus disposable PostgreSQL role tests. No hosted SQL, migration, Auth enrollment, Storage change, deployment, or shop-data change was performed. See [`docs/SUPABASE_MIGRATION_RECONCILIATION.md`](SUPABASE_MIGRATION_RECONCILIATION.md).

The hosted security advisor returned no lints during this read-only inspection, but that does not override the confirmed policy/grant findings or prove hosted behavior after remediation. The project remains **NO-GO** until the missing migrations are applied through an approved maintenance window, the real admin UUID is enrolled, and Auth/RLS/Storage smoke tests pass.

## Earlier verification records

The pre-Cycle-5 release-candidate head was verified by GitHub Actions run [#8](https://github.com/huntersam-ttl/jai-sunchandi-/actions/runs/37791549662), which completed successfully for commit `62d052e3e7d4b4e3a11d7d3aca7133516914a976`. The Cycle-5 head `f1227f2fcd278bf0e141cbc0ff2726cf1f1628a8` was then verified by run [#9](https://github.com/huntersam-ttl/jai-sunchandi-/actions/runs/37792452604). Both jobs passed: the backend PostgreSQL job applied every migration in lexical order, including `0017_public_request_limits.sql`, passed migration invariants, ran the mandatory PostgreSQL concurrency suite with 8 passing tests and no skips, and completed backend regression; the frontend job installed from the lockfile, passed 53 tests, and built successfully.

The repository-linked Supabase project was identified read-only as `jai-sunchandi-` (`hzpukedwffyuysvhvlbg`) in `ap-south-1`, matching the documented BOM deployment region. The project is currently `INACTIVE`; migration-history access timed out, so hosted schema, Auth enrollment, Storage policies, backup settings, and live RLS behavior remain **UNVERIFIED**. No wake-up, migration, SQL write, Auth change, Storage change, or customer-data access was attempted. The connected security and performance advisor calls returned no lints, but that does not replace a live schema audit while the project is inactive.

Supply-chain triage reduced the audit from 3 critical / 184 high / 70 moderate / 1 low to 0 critical / 160 high / 57 moderate / 1 low. The compatible changes update `form-data`, `proxy-addr`, `shell-quote`, `js-yaml`, and PostCSS pins. Remaining findings are predominantly CRA/Jest/SVGO/Tailwind/webpack development tooling; `axios` is the only directly imported audited frontend package, and its `form-data` path is patched. A CRA/toolchain replacement remains a separate proposal, not a hidden RC change.

Vercel configuration is reviewed statically: `vercel.json` deploys `frontend/build`, routes `/api` to `api/index.py`, and targets `bom1`; `.vercelignore` excludes environment files, tests, caches, and `node_modules`. Production environment separation cannot be confirmed from the repository because Vercel project settings are external. Keep preview credentials separate from production, set `ENVIRONMENT=production`, use explicit `ALLOWED_ORIGINS`, and never place service-role or database credentials in `REACT_APP_*` variables. When `REACT_APP_BACKEND_URL` is omitted, the frontend now uses same-origin `/api`, matching the checked-in rewrite; an explicit HTTPS backend origin remains supported.

Cycle 6 staging preparation is documented in [`docs/STAGING_VALIDATION.md`](STAGING_VALIDATION.md). The guarded read-only preflight tool is [`tools/staging_preflight.py`](../tools/staging_preflight.py); it rejects the known production domain and Supabase hosts and requires explicit confirmation for the optional rate-limit probe. No hosted staging target was available to execute it.

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
6. `0017_public_request_limits.sql`
7. `0018_harden_admin_membership_privileges.sql`

The GitHub PostgreSQL job bootstraps a disposable database, applies the same ordered chain, checks required columns, buckets, constraints, admin policy, old-policy removal, and dangerous-grant removal, then runs role-based PostgreSQL authorization tests. It does not touch hosted Supabase.

The rehearsal first applies the repository’s available historical baseline through 0013, then loads `supabase/rehearsal_hosted_legacy_state.sql`, a disposable-only fixture based on the read-only hosted observations: broad API-role table grants and four historical `auth.role()` policies. It then applies 0014–0018 and proves those bypasses and dangerous grants are removed. Any historical differences not represented by available repository SQL remain **UNVERIFIED** and must be checked from a fresh hosted schema/grant export before launch.

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

For all image buckets, confirm the 5 MB limit and JPEG/PNG/WebP MIME allowlist. Confirm anon has no read policy for private buckets, authenticated Storage policies require `shop_admins`, and the frontend contains only the anon key.

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
| `REACT_APP_SITE_URL` | Frontend build | Yes for production build | No | Canonical production origin used to generate `robots.txt` and `sitemap.xml`; production builds fail closed if absent. |
| Shop settings in `shop_settings` | Database | Yes before launch | No | Name, Nepali name, phone, WhatsApp, address, Maps link, hours, logo, messaging. Empty values intentionally hide optional contact UI. |

There is no tracked cron/scheduler configuration or rate-source automation. Daily rates are currently an admin-entered operational task; do not advertise automated publication until one is configured and monitored.

Public lead submissions are limited to five per HMAC'd client-address bucket per hour, and order-status lookups to twenty per ten minutes. Counters are stored in PostgreSQL so they work across Vercel instances. Direct anonymous Storage uploads still rely on Supabase's bucket size/MIME/path policies; add a managed edge/WAF limit before exposing the form broadly if abuse appears.

## Pricing policy gate

The current pricing paths were traced before release:

- `backend/utils.py::compute_price` applies a purity factor to a supplied per-tola rate.
- Public product estimates, admin live prices, and the legacy-compatible server calculator supply `gold_24k` for every gold product, then apply the product purity factor. Silver uses `silver`.
- The frontend quote calculator prefers a directly published `gold_22k` value for 22K, which can therefore disagree with the backend product estimate when the two stored rates differ. The current admin rate forms also submit the 24K value as the 22K value.
- Orders freeze `rate_per_tola`, `purity_factor`, component amounts, and totals in `order_items`; payments, invoices, and later rate changes must not recalculate historical orders. Old-gold valuation is a separate frozen order input and is not the catalogue price path.

No pricing formula was changed in this release candidate. Before real 22K products are quoted, the owner must choose and test one policy:

1. Keep one 24K base rate and derive all purities by factor; make the 22K display value explicitly informational, or remove it from operational entry.
2. Use dedicated published base rates per purity (at least 24K and 22K), and make every public estimate, admin preview, quote, and order snapshot use the same selected rate source. Add further purities only with an explicit fallback policy.
3. Treat each product as an explicitly quoted rate/price and stop deriving a catalogue estimate from daily rates; this is the least automatic option.

Option 2 is the recommended long-term architecture if the shop genuinely maintains separate 22K and 24K rates. It should be implemented only after owner approval, with an additive snapshot/rate-source migration, one shared backend calculation path, matching frontend tests, and regression cases for 24K, 22K, silver, missing rates, rate changes after reservation, cancellation, payment races, and old-gold deductions. Existing order snapshots must remain untouched. Until then, the release gate is to use only the already-tested 24K-factor policy and label estimates as estimates.

## Dependency audit disposition

The Yarn audit is not clean and must be reviewed before production exposure. The post-install audit tree contains three critical, 184 high, 70 moderate, and one low finding across 1,570 dependency entries; most are transitive development/build tooling rather than browser runtime packages. The safe scoped remediation in this phase pins Axios' transitive `form-data` to `4.0.6` instead of the previously forced `4.0.4`. Remaining `js-yaml`, PostCSS, webpack/dev-server, and test-tool findings are retained for a separate dependency-upgrade task because broad framework upgrades could destabilise the RC. Re-run the audit after any dependency change and record the residual list; do not treat the count alone as proof of an exploitable production path.

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

The SPA updates titles, canonical, Open Graph, Twitter, and store JSON-LD client-side. The production build requires `REACT_APP_SITE_URL` and generates `sitemap.xml` and `robots.txt` without indexing `/admin` or `/api`. Product URLs remain dynamic and are not included in the static sitemap until a product-feed decision is made.

Invoice and certificate verification are explicitly marked unavailable in this Supabase release candidate because their legacy records/routes are not migrated. Do not print or distribute verification QR links until those records and endpoints are migrated and tested.

## Performance and accessibility smoke test

- [ ] Test a Nepal mobile connection: home first paint, rate widget, catalogue, product gallery, and custom-order form.
- [ ] Confirm images use the existing responsive Supabase/Unsplash transformations and uploads remain capped/compressed.
- [ ] Confirm keyboard focus, form labels/errors, gallery buttons, 44px tap targets, contrast, and reduced-motion behavior.
- [ ] Check the production bundle/build report and browser console for failed API or asset requests.

## Rollback

There are no down migrations. If a migration fails, stop, preserve the error and backup, and do not continue partially. Restore the disposable/hosted database snapshot or use a reviewed forward-fix SQL script.

### Free-plan backup reality

The hosted project is on the Free plan. Current Supabase documentation says downloadable managed database backups are not available on Free, and Storage objects are not included in database backups. Before a live upgrade, use an owner-approved `supabase db dump`/`pg_dump` export of roles, schema, and data into encrypted off-repository storage, and separately inventory/download required Storage objects. Treat that export as **UNVERIFIED** until it has been restored into disposable PostgreSQL and the application smoke suite passes. Do not export real customer data in CI or this repository.

If 0014 causes admin lockout, use the Supabase SQL editor or service-role maintenance connection to insert the verified Auth UUID into `public.shop_admins`, then re-test login and Storage. If a Storage policy breaks uploads, keep private buckets private, pause public forms, restore the known policy from backup/reviewed SQL, and do not make the bucket public as a workaround.

For application rollback, promote the last known-good Vercel deployment and keep the database at the compatible migration level. Do not roll code back across a schema change unless the older code is confirmed compatible with the applied columns and enum values.

## After launch

- [ ] Monitor Vercel function errors, Supabase Auth/Storage logs, database health, and failed public leads.
- [ ] Confirm the daily rate is entered and visible each business day.
- [ ] Verify the first real product, first real order/payment, and first collection end-to-end.
- [ ] Take a fresh backup before the next migration or operational bulk update.

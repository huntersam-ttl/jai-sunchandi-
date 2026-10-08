# Controlled staging validation

This runbook describes the smallest safe staging environment. It uses synthetic records and must remain separate from the inactive Supabase project until the owner explicitly approves activation or creates a disposable project.

## Required separation

Use a Vercel Preview deployment or a local backend/frontend pointed at a disposable Supabase project. Staging must have:

- a separate Supabase project and database URL;
- a separate Auth user created only for staging;
- separate Storage buckets or a separate project, never production buckets;
- synthetic shop settings, products, customers, orders, payments, photos, and PINs;
- a preview-only domain and explicit `ALLOWED_ORIGINS`;
- no production WhatsApp number, service-role key, database URL, or customer records.

Do not activate `hzpukedwffyuysvhvlbg` as part of this runbook. It is the identified repository-linked project but is currently inactive, and its migration state could not be read.

## Preflight tool

`tools/staging_preflight.py` is read-only by default. It accepts only localhost, `*.vercel.app`, or an explicitly supplied `STAGING_ALLOWED_HOST`; it rejects the known production domain, Supabase hosts, and embedded credentials.

```powershell
$env:STAGING_BASE_URL = "https://your-preview.vercel.app"
$py = "C:\path\to\python.exe"
& $py tools/staging_preflight.py
```

The preflight checks liveness, database health, public rates/settings/catalogue, and a synthetic order-status lookup. It never creates a record. To exercise the PostgreSQL-backed limiter, use only against staging:

```powershell
$env:STAGING_CONFIRMATION = "I_UNDERSTAND_SYNTHETIC_STAGING"
& $py tools/staging_preflight.py --rate-limit-probe
```

That probe makes 21 synthetic order-status requests and expects the 21st to receive `429`; it intentionally increments staging counters and must not be pointed at production.

## Migration procedure for a disposable project

1. Record the project ref, region, PostgreSQL version, Auth settings, Storage buckets, backup capability, and current migration history.
2. Confirm the database contains no real records. Export a disposable backup/snapshot if the platform supports it.
3. Bootstrap only the disposable PostgreSQL instance with `supabase/ci_bootstrap.sql` or a newly created empty Supabase project.
4. Apply migrations `0001` through `0017` in lexical order with `ON_ERROR_STOP` enabled.
5. Run the CI invariant queries and the eight PostgreSQL concurrency tests.
6. Enrol only the synthetic staging Auth UUID in `shop_admins` using the documented idempotent SQL pattern.
7. Verify RLS and Storage with the four authorization identities below.
8. Run the smoke matrix and preserve logs without customer data or secrets.

Never apply the full chain blindly to an existing database. First compare migration history and schema; if history is missing or divergent, stop for an owner-approved recovery plan.

## Authorization matrix

| Identity | Expected access |
| --- | --- |
| Anonymous visitor | Public catalogue/rates/settings; no customers, orders, payments, admin tables, or private objects |
| Authenticated but unenrolled user | No admin table or Storage access; cannot self-enrol |
| Enrolled staging administrator | Intended admin CRUD, product uploads, private-photo proxy access, payment/order workflows |
| Backend service role | Server-side repository and Storage operations only; never returned to the browser |

Hosted Supabase Auth JWT verification and Storage behavior must be tested separately from local PostgreSQL RLS assertions. A green CI run does not prove the hosted control plane is configured correctly.

## Synthetic smoke matrix

- Public: homepage, rates, catalogue, product detail, custom-order enquiry, repair enquiry, order-status lookup, invoice/certificate unavailable states.
- Admin: login, dashboard, rate entry, product creation/photo upload, customer, order/reservation, payment, cancellation/release, repairs, bill archive, settings.
- Collection: issue PIN, reject wrong PIN, collect with correct PIN, reject reuse.
- Security: anonymous private-object read rejected; unenrolled Auth access rejected; enrolled admin access succeeds; service-role key absent from built assets.
- Recovery: stop after a failed migration; restore the disposable snapshot or use a reviewed forward fix; do not retry against an ambiguous schema.

## Go/no-go conditions

GO requires a separate staging target, successful preflight and smoke matrix, verified hosted Auth/RLS/Storage behavior, a tested backup/recovery path, populated real shop settings, and owner approval of the 22K pricing policy. Any missing hosted evidence, production environment separation, or pricing approval is NO-GO.

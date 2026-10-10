# Family backend: controlled production cutover

Status: **BLOCKED until verified production backup and approved admin enrollment**.
This document is a runbook, not permission to run destructive SQL.

## Current mismatch (10 October 2026)

- Original Supabase project: `hzpukedwffyuysvhvlbg`; migrations recorded through 0013 only.
- Isolated staging project: `znnvnrkdevklfpgvuuip`; migrations 0014–0019 applied.
- Original database contains shop data (at least four products and one bill archive).
- Production includes a Supabase Auth account, but there is no `shop_admins` table.
- Public data API and admin operations must not bypass the enforced membership rules.

## Gate A: safe backup

1. In the Supabase Production dashboard, confirm the latest recoverable backup and
   the retention window; do not infer this from the presence of tables.
2. Verify a restore path into an isolated database; document the snapshot time.
3. Export/verify Storage objects separately where required by the backup plan.
4. Record an approved rollback plan and arrange a maintenance window.
5. Never use staging data to overwrite Production.

## Gate B: admin identity

1. Confirm the authorized family administrator's **existing** `auth.users.id`
   through a privileged SQL read (do not copy email or credentials into logs).
2. Apply migrations in dependency order. Migration 0014 creates
   `shop_admins` and changes authenticated RLS; it **fails closed** until
   an approved user is enrolled via a privileged connection.
3. Approve and enroll that exact user ID after migrations; do not create a
   privileged account automatically, do not grant everyone admin access.
4. Validate JWT login, whoami, direct-table RLS and private Storage access.

## Gate C: schema and application

1. Review migration SQL files 0014 through 0019, including storage policies
   and constraint changes. Reconcile remote migration history before applying.
2. Apply them one at a time to the *approved* Production database after backup.
3. GET /api/admin/system-readiness as an enrolled administrator: `ready: true`.
4. Verify anonymous users cannot read customers, payments, private leads,
   customer voice notes, or archived bills. Deny non-member JWTs.
5. Use rollback-only synthetic transactions for customer/order/payment/repair
   relations. Test document and audio uploads only in staging first.
6. With explicit approval, run a single controlled real workflow in Production:
   create product, customer, order, payment, repair, bill-photo reference and lead;
   verify balances and status transitions, then archive synthetic records.
7. Check frontend/backend CI and live Vercel environment config match the
   intended Supabase project, with server secrets never included in the frontend.

## Known non-goals

- Digital invoicing, printable bills, online checkout and online payments.
- Auto-enrolling an arbitrary authenticated user.
- Merging the draft PR or upgrading the live database without the gates above.

## Current CI

The disposable PostgreSQL runner checks migrations and repository regression
tests. CI passing does **not** imply the existing hosted Production database
is compatible or that real audio playback has been verified.

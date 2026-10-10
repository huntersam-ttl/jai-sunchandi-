# Supabase migration reconciliation

This record compares the repository chain with the hosted project `hzpukedwffyuysvhvlbg`. It is based on read-only hosted inspection on 2026-10-08. No hosted migration or SQL write was executed.

## Current state

The repository has migrations `0001` through `0018`. Hosted Supabase reports 14 timestamped historical migrations through `20260709110912_leads_soft_delete`; it does not yet contain the repository’s `0014_admin_membership_rls.sql` through `0018_harden_admin_membership_privileges.sql` objects. Hosted PostgreSQL is 17.6; CI validates the chain on PostgreSQL 16.

| Repository | Hosted historical record / status | Deployment note |
| --- | --- | --- |
| 0001 `init` | `20260704123759_init` | Baseline exists, but historical authenticated `admin_all` policies remain until 0014/0018. |
| 0002 `public_read_hardening` | `20260704124234_public_read_hardening` | Public views and anonymous read policies exist. |
| 0003 `fix_product_column_grants` | `20260704124427_fix_product_column_grants` | Preserve the non-cost anonymous product column boundary. |
| Hosted V1 tasks/order-items/templates change | `20260704145417_v1_tasks_order_items_templates` | Historical schema addition; reconcile against current files before any production apply. |
| 0004 `public_upload_policies` | `20260706141642_public_upload_policies` | Hosted anonymous upload policy was bucket-scoped; 0016/0018 reassert path restrictions. |
| 0006 `product_cost_price` | `20260707230609_product_cost_price` | Additive cost fields. |
| 0005 `expenses` | `20260707234339_expenses` | Admin-only cashbook table. |
| 0007 `order_items_schema_reconcile` | `20260707234417_order_items_schema_reconcile` | Schema reconciliation; inspect existing rows/indexes before apply. |
| 0008 `dashboard_perf_indexes` | `20260708110653_dashboard_perf_indexes` | Index-only. |
| 0009 `admin_list_perf_indexes` | `20260708142856_admin_list_perf_indexes` | Index-only. |
| 0010 `repairs_search_index` | `20260708231505_repairs_search_index` | Index-only. |
| 0011 `bill_archives` | `20260709002558_bill_archives` | Hosted historical bill archive record; confirm exact object/index state before applying anything else. |
| 0012 `bill_photos_bucket_limits` | `20260709085919_bill_photos_bucket_limits` | Bucket limits are present: 5 MB, JPEG/PNG/WebP. |
| 0013 `leads_soft_delete` | `20260709110912_leads_soft_delete` | Hosted leads has the soft-delete column. |
| 0014 `admin_membership_rls` | Not hosted | Apply only after verifying `auth.users`; it creates `shop_admins` and intentionally locks direct authenticated access until enrollment. |
| 0015 `customer_fulfilment_fields` | Not hosted | Additive lead fulfilment fields. |
| 0016 `secure_fulfilment_workflow` | Not hosted | Adds fulfilment/pickup fields, constraints, and restricted upload paths; review data values before applying. |
| 0017 `public_request_limits` | Not hosted | Backend rate-limit state table; backend must be deployed compatibly. |
| 0018 `harden_admin_membership_privileges` | Not hosted | Corrective security migration: removes historical bypass policies and excessive API/Storage grants. Apply last. |

The timestamped hosted names are historical evidence, not a safe instruction to replay SQL. Before deployment, record the exact hosted schema, constraints, indexes, policies, grants, bucket settings, and row counts; use a backup/snapshot; then apply only the missing repository migrations in dependency order with `ON_ERROR_STOP`.

## Corrective security target

After 0018:

- `authenticated` table access is useful only through RLS membership in `shop_admins`.
- Anonymous public reads remain limited to the existing safe views/policies.
- Anonymous lead/repair uploads remain insert-only and path-restricted.
- Storage object grants retain API-required read/write operations but remove `TRUNCATE`, `REFERENCES`, and `TRIGGER` from `anon` and `authenticated`.
- `shop_admins` enrollment remains a privileged operational step; an authenticated user cannot self-enrol.
- Backend service-role operations remain the application’s server-side data path.

The local role tests in `backend/tests/test_postgres_rls_security.py` exercise `anon`, an unenrolled `authenticated` identity, and an enrolled admin against the disposable CI database. They do not prove hosted Auth JWT, Storage API, or dashboard behavior; those remain a separate staging/hosted verification gate.

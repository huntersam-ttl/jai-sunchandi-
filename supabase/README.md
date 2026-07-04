# Supabase — Jai Supa Deurali Sun-Chandi Pasal

Schema is the source of truth in `supabase/migrations/`. Applied once, in order.

## Migrations
- `0001_init.sql` — full V1 schema: tables, FKs, indexes, CHECK constraints,
  `updated_at` trigger, code sequences, RLS policies, public-safe read views,
  Storage buckets, and reference seed data.
- `0002_public_read_hardening.sql` — switches the `public_*` views to
  SECURITY INVOKER, adds anon read policies + column-level grants (cost columns
  never exposed), and pins the trigger function's `search_path`. Clears the
  security-advisor ERRORs from 0001.
- `0003_fix_product_column_grants.sql` — grants anon the two visibility flags
  (`show_on_website`, `is_deleted`) referenced by the `public_products` view's
  WHERE clause, so the invoker view resolves for anon.

Applied to project `hzpukedwffyuysvhvlbg` (org "samir Org", region ap-south-1).
Security advisor after 0003: 0 errors (only intentional single-admin
`rls_policy_always_true` warnings on the admin/lead-insert policies).

## Applying `0001_init.sql`
Once the Supabase project `jai-supa-deurali` exists (blocked at time of writing by
the org's free-tier 2-active-project limit — free a slot or upgrade first):

- **Via the Supabase connector (MCP):** `apply_migration(project_id, name="init", query=<file contents>)`.
- **Via the Supabase CLI:** `supabase link --project-ref <ref>` then `supabase db push`
  (the CLI expects timestamped filenames like `20260704_init.sql`; rename if using the CLI).
- **Via the SQL editor:** paste the file contents and run.

## Required environment variables (set later, in S2/S3 — not committed)
Backend (`backend/.env`):
- `SUPABASE_DB_URL` — Postgres connection string (asyncpg), service-role/pooler
- `SUPABASE_SERVICE_ROLE_KEY` — **backend only; never ship to the frontend**
- `SUPABASE_JWT_SECRET` — to verify Supabase-issued admin JWTs
- `SUPABASE_URL`

Frontend (`frontend/.env`):
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY` — anon key only (safe for the browser)

## Security model (summary)
- Backend connects with the **service role** (bypasses RLS) and mediates all business data.
- `anon`: may INSERT `leads`; may SELECT only the `public_*` views (safe columns/rows).
  No public read of base tables — customer, order, payment, khata, and product cost data
  are never exposed.
- `authenticated` (the single admin via Supabase Auth): full access (RLS backstop).

## Notes
- The `public_*` views are intentionally owner-defined (security-definer) so they expose a
  curated public subset; a Supabase advisor "security definer view" warning here is expected.
- The SQL has not yet been executed against Postgres (no project provisioned); it will be
  validated on first apply.

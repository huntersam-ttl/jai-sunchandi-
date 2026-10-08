# Vercel deployment readiness

This is a read-only repository assessment. No Vercel deployment, environment-variable change, domain attachment, or promotion was performed.

## Assessment

| Area | Status | Evidence / action |
| --- | --- | --- |
| React build | PASS | `vercel.json` runs the locked Yarn install and `frontend` production build; CI builds successfully. |
| Python entrypoint | PASS | `api/index.py` exposes the FastAPI `app` and adds `backend/` to `sys.path`. |
| Python dependencies | PASS after local fix | Vercel’s current Python runtime documentation expects a root `requirements.txt`/`pyproject.toml`; the repository now has a root runtime-only `requirements.txt`, while the larger backend file remains for CI/development. |
| `/api` routing | PASS static | The API rewrite precedes the SPA fallback. |
| SPA fallback | PASS static | The final rewrite sends non-API routes to `/index.html`. |
| Production environment guard | PASS static | Production CORS denies requests when `ALLOWED_ORIGINS` is absent; production SEO builds fail if `REACT_APP_SITE_URL` is absent. |
| Secret separation | PASS static | Frontend examples and source contain no service-role key or database URL references. |
| Supabase connectivity | UNVERIFIED | Requires a non-production Vercel Preview environment with disposable Supabase credentials. |
| Vercel project settings/logs | UNVERIFIED | No connected read-only Vercel project inspection was available in this cycle. |
| Bundle size/cold start | UNVERIFIED | `backend/requirements.txt` is broad; measure the deployed Python function bundle before launch. |

The configured `bom1` function region is geographically aligned with the hosted Supabase `ap-south-1` region, but latency and connection-pool behavior still require a real isolated preview smoke test.

## Required environment separation

Preview and Production must have separate values for:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_URL`
- `SUPABASE_JWT_SECRET` if retained by deployment tooling
- `ADMIN_EMAIL`
- `ALLOWED_ORIGINS`
- `REACT_APP_BACKEND_URL`
- `REACT_APP_SUPABASE_URL`
- `REACT_APP_SUPABASE_ANON_KEY`
- `REACT_APP_SITE_URL`

Production must set `ENVIRONMENT=production`; Preview must point only at disposable/staging data and a preview origin. Never copy a production database URL or service-role key into Preview.

## Safe Preview procedure

1. Create or select an isolated Supabase staging project/database; if none exists, stop with **BLOCKED**.
2. Apply migrations 0001–0018 to that isolated target and enroll only a synthetic Auth administrator.
3. Configure Vercel Preview variables with staging values and the exact preview URL in `ALLOWED_ORIGINS`.
4. Deploy a Preview from the release commit through the normal Vercel integration.
5. Verify `/api/health`, `/api/health/supabase`, public catalogue/rates/settings, admin login, product upload, private enquiry-photo access, order/payment/pickup smoke tests, and browser console errors.
6. Confirm the Preview cannot read production records and that no production service key appears in built assets or logs.

## Controlled Production procedure

Production requires explicit owner approval for the hosted Supabase upgrade, administrator enrollment, pricing policy, shop settings, domain, and deployment. Then:

1. Record the backup/export, migration history, schema/grants/policies, Storage bucket settings, Vercel rollback deployment, and environment-variable names.
2. Apply only reviewed missing migrations in the approved maintenance window.
3. Verify admin Auth/RLS/Storage and public flows before changing DNS or promoting traffic.
4. Configure Production variables, deploy the exact approved commit, and validate `/api/health`, storefront, admin, first order, payment, and collection.
5. Monitor Vercel function logs, Supabase logs, failed submissions, and the first real collection.

## Rollback

Application rollback is the previous known-good Vercel deployment, provided it is compatible with the applied schema. Database rollback is a reviewed forward fix or restore into a replacement/disposable project; there are no down migrations. Do not roll code back across 0014–0018 without confirming schema and authorization compatibility.

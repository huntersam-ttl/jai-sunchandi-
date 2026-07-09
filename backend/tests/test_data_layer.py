"""S2 data-layer checks (server-less; no live DB required).

Run: REACT_APP_BACKEND_URL=x pytest backend/tests/test_data_layer.py
(the env var only satisfies the existing Mongo conftest.)
"""
import py_compile
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import config          # noqa: E402
import db              # noqa: E402
import models          # noqa: E402
import repositories as repos            # noqa: E402
from repositories.base import derive_payment_status  # noqa: E402


class TestConfigLoadsSafely:
    def test_import_without_env_is_safe(self):
        assert isinstance(config.missing_backend_settings(), list)

    def test_async_db_url_normalisation(self, monkeypatch):
        monkeypatch.setattr(config, "SUPABASE_DB_URL", "postgresql://u:p@h:5432/db")
        assert config.async_database_url().startswith("postgresql+asyncpg://")
        monkeypatch.setattr(config, "SUPABASE_DB_URL", "")
        assert config.async_database_url() == ""

    def test_allowed_origins_never_wildcard(self, monkeypatch):
        monkeypatch.setenv("ALLOWED_ORIGINS", "*")
        assert "*" not in config.get_allowed_origins()


class TestNoServiceRoleKeyInFrontend:
    def test_frontend_env_example_excludes_backend_secrets(self):
        # Inspect actual variable assignments (ignore comments/warnings).
        lines = (BACKEND.parent / "frontend" / ".env.example").read_text().splitlines()
        assigned = [ln.split("=", 1)[0].strip() for ln in lines
                    if "=" in ln and not ln.strip().startswith("#")]
        assert "SUPABASE_SERVICE_ROLE_KEY" not in assigned
        assert "SUPABASE_DB_URL" not in assigned
        assert "REACT_APP_SUPABASE_ANON_KEY" in assigned  # only anon key allowed

    def test_frontend_src_has_no_backend_secret_refs(self):
        src = BACKEND.parent / "frontend" / "src"
        hits = [str(p) for p in src.rglob("*.js")
                if "SERVICE_ROLE" in p.read_text(errors="ignore")
                or "SUPABASE_DB_URL" in p.read_text(errors="ignore")]
        assert hits == [], f"backend secret referenced in frontend: {hits}"


class TestDataLayerImports:
    def test_db_helpers_import_without_creating_engine(self):
        assert hasattr(db, "get_engine")
        assert hasattr(db, "get_session")
        assert hasattr(db, "check_connection")
        assert db._engine is None  # importing db must not connect

    def test_all_models_present(self):
        for name in ("ShopSettings", "Category", "Collection", "DailyRate", "Product",
                     "Customer", "Order", "OrderItem", "Payment", "RepairJob", "Lead",
                     "Expense", "AdminTask", "MaterialTask", "WhatsappTemplate"):
            assert hasattr(models, name), name

    def test_all_repositories_present(self):
        for name in ("SettingsRepository", "CategoriesRepository", "CollectionsRepository",
                     "RatesRepository", "ProductsRepository", "CustomersRepository",
                     "OrdersRepository", "PaymentsRepository", "ExpensesRepository", "RepairsRepository",
                     "LeadsRepository", "AdminTasksRepository", "MaterialTasksRepository",
                     "TemplatesRepository"):
            assert hasattr(repos, name), name

    def test_expense_model_fields(self):
        cols = models.Expense.__table__.c
        for name in ("id", "date_ad", "category", "description", "amount",
                     "payment_method", "created_at", "updated_at"):
            assert name in cols
        assert str(cols.amount.type) == "NUMERIC(12, 2)"


class TestPaymentStatusDerivation:
    def test_unpaid_partial_paid(self):
        assert derive_payment_status(1000, 0) == "unpaid"
        assert derive_payment_status(1000, 500) == "partial"
        assert derive_payment_status(1000, 1000) == "paid"
        assert derive_payment_status(1000, 1200) == "paid"


class TestSupabaseAppAndAuth:
    def test_supabase_auth_importable(self):
        import supabase_auth
        assert hasattr(supabase_auth, "get_current_admin")
        assert hasattr(supabase_auth, "verify_supabase_jwt")

    @staticmethod
    def _es256_admin_token(email: str, monkeypatch):
        """Mint a real ES256 token and monkeypatch supabase_auth's JWKS client
        to resolve it via the matching public key -- exercises the actual
        JWKS/ES256 decode path without needing network access to a real
        Supabase project."""
        import jwt as pyjwt
        from cryptography.hazmat.primitives.asymmetric import ec
        import supabase_auth

        private_key = ec.generate_private_key(ec.SECP256R1())
        token = pyjwt.encode(
            {"sub": "u1", "email": email, "aud": "authenticated"},
            private_key, algorithm="ES256", headers={"kid": "test-key-1"})

        class FakeSigningKey:
            key = private_key.public_key()

        class FakeJWKClient:
            def get_signing_key_from_jwt(self, token):
                return FakeSigningKey()

        monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(supabase_auth, "_get_jwks_client", lambda: FakeJWKClient())
        return token

    def test_jwks_url_derived_from_supabase_url(self, monkeypatch):
        import supabase_auth
        monkeypatch.setattr(config, "SUPABASE_URL", "https://abcxyz.supabase.co")
        assert supabase_auth._jwks_url() == "https://abcxyz.supabase.co/auth/v1/.well-known/jwks.json"

    def test_valid_es256_token_verifies_via_jwks(self, monkeypatch):
        import supabase_auth
        token = self._es256_admin_token("admin@example.com", monkeypatch)
        claims = supabase_auth.verify_supabase_jwt(token)
        assert claims["email"] == "admin@example.com"

    def test_admin_email_mismatch_returns_403_not_401(self, monkeypatch):
        import asyncio

        from fastapi import HTTPException
        import supabase_auth

        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@example.com")
        token = self._es256_admin_token("someone-else@example.com", monkeypatch)

        class FakeRequest:
            headers = {"Authorization": f"Bearer {token}"}

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(supabase_auth.get_current_admin(FakeRequest()))
        assert exc_info.value.status_code == 403
        assert exc_info.value.detail == "Admin access required"

    def test_valid_admin_token_returns_claims(self, monkeypatch):
        import asyncio

        import supabase_auth

        monkeypatch.setattr(config, "ADMIN_EMAIL", "admin@example.com")
        token = self._es256_admin_token("admin@example.com", monkeypatch)

        class FakeRequest:
            headers = {"Authorization": f"Bearer {token}"}

        result = asyncio.run(supabase_auth.get_current_admin(FakeRequest()))
        assert result["email"] == "admin@example.com"

    def test_missing_token_returns_401(self):
        import asyncio

        from fastapi import HTTPException
        import supabase_auth

        class FakeRequest:
            headers = {}

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(supabase_auth.get_current_admin(FakeRequest()))
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Not authenticated"

    def test_invalid_token_returns_401(self, monkeypatch):
        import asyncio

        from fastapi import HTTPException
        import supabase_auth

        monkeypatch.setattr(config, "SUPABASE_URL", "https://example.supabase.co")

        class FakeJWKClient:
            def get_signing_key_from_jwt(self, token):
                raise Exception("signing key not found")

        monkeypatch.setattr(supabase_auth, "_get_jwks_client", lambda: FakeJWKClient())

        class FakeRequest:
            headers = {"Authorization": "Bearer not-a-real-jwt"}

        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(supabase_auth.get_current_admin(FakeRequest()))
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid token"

    def test_app_health_and_protected_routes_registered(self):
        import app
        paths = {r.path for r in app.app.routes}
        assert "/api/health" in paths
        assert "/api/health/supabase" in paths
        assert "/api/admin/whoami" in paths

    def test_public_read_routes_registered(self):
        import app
        paths = {r.path for r in app.app.routes}
        for p in ("/api/rates/today", "/api/rates/history", "/api/categories",
                  "/api/collections", "/api/products", "/api/products/{id_or_code}",
                  "/api/settings"):
            assert p in paths, p

    def test_public_write_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        paths = {p for p, _ in routes}
        assert "/api/leads" in paths
        assert "/api/public/order-status" in paths
        # /api/leads must accept POST
        assert any(p == "/api/leads" and "POST" in m for p, m in routes)

    def test_admin_reference_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        paths = {p for p, _ in routes}
        for p in ("/api/admin/rates", "/api/admin/categories",
                  "/api/admin/categories/{cid}", "/api/admin/collections",
                  "/api/admin/collections/{cid}"):
            assert p in paths, p
        assert any(p == "/api/admin/rates" and "POST" in m for p, m in routes)
        assert any(p == "/api/admin/categories/{cid}" and "DELETE" in m for p, m in routes)

    def test_admin_product_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        paths = {p for p, _ in routes}
        assert "/api/admin/products" in paths
        assert "/api/admin/products/{pid}" in paths
        for method, path in (("GET", "/api/admin/products"), ("POST", "/api/admin/products"),
                             ("GET", "/api/admin/products/{pid}"), ("PUT", "/api/admin/products/{pid}"),
                             ("DELETE", "/api/admin/products/{pid}")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_customer_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/customers"), ("POST", "/api/admin/customers"),
                             ("GET", "/api/admin/customers/dues"),
                             ("GET", "/api/admin/customers/{cid}"), ("PUT", "/api/admin/customers/{cid}")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_order_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/orders"), ("POST", "/api/admin/orders"),
                             ("GET", "/api/admin/orders/{oid}"), ("PUT", "/api/admin/orders/{oid}"),
                             ("PATCH", "/api/admin/orders/{oid}"),
                             ("PATCH", "/api/admin/orders/{oid}/status")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_order_number_uses_server_default(self):
        assert models.Order.__table__.c.order_number.server_default is not None

    def test_product_cost_price_column_nullable(self):
        col = models.Product.__table__.c.cost_price
        assert col.nullable is True

    def test_order_item_cost_price_column_nullable(self):
        col = models.OrderItem.__table__.c.cost_price
        assert col.nullable is True

    def test_product_body_accepts_optional_cost_price(self):
        import admin_routes
        body = admin_routes.ProductBody(name="Ring", weight=admin_routes.WeightInput(grams=5))
        assert body.cost_price is None
        body_with_cost = admin_routes.ProductBody(
            name="Ring", weight=admin_routes.WeightInput(grams=5), cost_price=1500.0)
        assert body_with_cost.cost_price == 1500.0

    def test_order_item_cost_snapshot_never_trusts_client_value(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes._snapshot_item_cost_prices)
        # Every item's cost_price is reset to None first, then only overridden
        # from the server-fetched Product row — never from client input.
        assert 'item["cost_price"] = None' in src
        assert "product.cost_price" in src
        assert "session.get(Product" in src

    def test_order_item_line_number_has_no_default(self):
        # line_number must be supplied by the app for every item — a static
        # column default previously made every row in a multi-item order
        # collide on UNIQUE(order_id, line_number).
        col = models.OrderItem.__table__.c.line_number
        assert col.nullable is False
        assert col.server_default is None
        assert col.default is None

    def test_create_order_assigns_sequential_line_numbers(self):
        import inspect

        from repositories.orders_repo import OrdersRepository
        src = inspect.getsource(OrdersRepository.create_order)
        assert "enumerate(items, start=1)" in src
        assert "line_number=line_number" in src

    def test_order_items_relationship_ordered_by_line_number(self):
        assert models.Order.items.property.order_by is not None

    def test_admin_payment_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/orders/{oid}/payments"),
                             ("POST", "/api/admin/orders/{oid}/payments")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_expense_cashbook_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/expenses"), ("POST", "/api/admin/expenses"),
                             ("PATCH", "/api/admin/expenses/{eid}"),
                             ("GET", "/api/admin/cashbook")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_cashbook_shape_is_cash_movement_only(self):
        import inspect

        from repositories.expenses_repo import ExpensesRepository
        src = inspect.getsource(ExpensesRepository.cashbook)
        assert "cash_in" in src
        assert "cash_out" in src
        assert "net_cash" in src
        assert "repair_id" not in src
        assert "cost_price" not in src

    def test_admin_lead_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/leads"), ("GET", "/api/admin/leads/{lid}"),
                             ("PATCH", "/api/admin/leads/{lid}"),
                             ("PATCH", "/api/admin/leads/{lid}/status")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_repair_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/repairs"), ("POST", "/api/admin/repairs"),
                             ("GET", "/api/admin/repairs/{rid}"), ("PUT", "/api/admin/repairs/{rid}"),
                             ("PATCH", "/api/admin/repairs/{rid}")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_repair_number_uses_server_default(self):
        assert models.RepairJob.__table__.c.repair_number.server_default is not None

    def test_admin_dashboard_route_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        assert any(p == "/api/admin/dashboard" and "GET" in m for p, m in routes)

    def test_admin_dashboard_includes_repairs_and_leads_summary(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.dashboard)
        for key in ("pending_repairs_count", "pending_repairs", "recent_leads"):
            assert key in src, key

    def test_dashboard_queries_are_capped_and_use_order_summary(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.dashboard)
        # Every order-list query passed a limit; none use the heavy full
        # shaper (which touches .items/.payments -- an async lazy-load error
        # now that those relationships are explicitly noload'd).
        for call in ("due_today(limit=", "due_this_week(limit=",
                     "ready_for_collection(limit=", "pending_payments(limit=",
                     "list_pending(limit=", "list(limit="):
            assert call in src, call
        assert "_order(o)" not in src
        assert "_order_summary(o)" in src

    def test_order_summary_never_touches_items_or_payments(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes._order_summary)
        assert ".items" not in src
        assert ".payments" not in src

    def test_orders_repo_dashboard_queries_use_noload(self):
        import inspect

        from repositories.orders_repo import OrdersRepository
        for name in ("due_today", "due_this_week", "ready_for_collection", "pending_payments"):
            src = inspect.getsource(getattr(OrdersRepository, name))
            assert "noload(Order.items)" in src, name
            assert "noload(Order.payments)" in src, name

    def test_repairs_repo_has_capped_pending_query(self):
        from repositories.repairs_repo import RepairsRepository
        assert hasattr(RepairsRepository, "list_pending")
        assert hasattr(RepairsRepository, "count_pending")

    def test_leads_repo_list_accepts_limit(self):
        import inspect

        from repositories.leads_repo import LeadsRepository
        sig = inspect.signature(LeadsRepository.list)
        assert "limit" in sig.parameters

    def test_reports_uses_uncapped_totals_for_accuracy(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.reports)
        # Reports needs true totals, not the dashboard's capped previews --
        # must not pass a limit here.
        assert "due_this_week()" in src
        assert "pending_payments()" in src

    def test_admin_task_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/tasks"), ("POST", "/api/admin/tasks"),
                             ("PATCH", "/api/admin/tasks/{tid}"),
                             ("GET", "/api/admin/material-tasks"),
                             ("PATCH", "/api/admin/material-tasks/{mid}")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_template_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/templates"),
                             ("PATCH", "/api/admin/templates/{tpid}")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_settings_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/settings"), ("PUT", "/api/admin/settings")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_admin_reports_route_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        assert any(p == "/api/admin/reports" and "GET" in m for p, m in routes)


class TestExistingMongoBackendStillCompiles:
    def test_mongo_modules_parse(self):
        for name in ("server.py", "auth.py", "utils.py"):
            py_compile.compile(str(BACKEND / name), doraise=True)


class TestAdminListPaginationAndSearch:
    """S6 perf pass: admin list endpoints must be bounded (limit/offset) and
    push q= search into SQL instead of fetching every row and filtering in
    Python."""

    def test_list_repos_accept_limit_offset(self):
        import inspect

        from repositories.customers_repo import CustomersRepository
        from repositories.leads_repo import LeadsRepository
        from repositories.orders_repo import OrdersRepository
        from repositories.products_repo import ProductsRepository
        from repositories.repairs_repo import RepairsRepository

        for repo, method in (
            (ProductsRepository, "list"), (OrdersRepository, "list"),
            (CustomersRepository, "search"), (LeadsRepository, "list"),
            (RepairsRepository, "list"),
        ):
            sig = inspect.signature(getattr(repo, method))
            assert "limit" in sig.parameters, f"{repo.__name__}.{method}"
            assert "offset" in sig.parameters, f"{repo.__name__}.{method}"

    def test_list_repos_have_sql_count(self):
        from repositories.customers_repo import CustomersRepository
        from repositories.leads_repo import LeadsRepository
        from repositories.orders_repo import OrdersRepository
        from repositories.products_repo import ProductsRepository
        from repositories.repairs_repo import RepairsRepository

        for repo in (ProductsRepository, OrdersRepository, CustomersRepository,
                     LeadsRepository, RepairsRepository):
            assert hasattr(repo, "count"), repo.__name__

    def test_orders_list_query_pushes_search_to_sql_and_noloads_relations(self):
        import inspect

        from repositories.orders_repo import OrdersRepository
        src = inspect.getsource(OrdersRepository.list)
        assert "ilike" in src
        assert "noload(Order.items)" in src
        assert "noload(Order.payments)" in src

    def test_products_list_query_pushes_search_to_sql(self):
        import inspect

        import repositories.products_repo as products_repo
        # The ilike filter lives in a shared module-level helper, reused by
        # both list() and count() so search/pagination totals never drift.
        src = inspect.getsource(products_repo)
        assert "ilike" in src
        assert "_search_filter(q)" in inspect.getsource(products_repo.ProductsRepository.list)

    def test_admin_list_routes_return_items_and_total(self):
        import inspect

        import admin_routes
        for fn in (admin_routes.list_products, admin_routes.list_orders,
                   admin_routes.list_customers):
            src = inspect.getsource(fn)
            assert '"items"' in src and '"total"' in src, fn.__name__

    def test_admin_list_routes_no_longer_filter_in_python(self):
        import inspect

        import admin_routes
        for fn in (admin_routes.list_products, admin_routes.list_orders):
            src = inspect.getsource(fn)
            # Previously these fetched everything then did `[.. for .. in rows if ..]`
            # in Python -- that pattern must be gone now that q is a SQL filter.
            assert " if ql in " not in src, fn.__name__

    def test_dashboard_and_list_routes_have_timing_logs(self):
        import inspect

        import admin_routes
        for fn in (admin_routes.dashboard, admin_routes.list_tasks,
                   admin_routes.list_products, admin_routes.list_orders,
                   admin_routes.list_customers, admin_routes.list_expenses,
                   admin_routes.list_leads, admin_routes.list_repairs,
                   admin_routes.cashbook):
            src = inspect.getsource(fn)
            assert "_timed(" in src, fn.__name__

    def test_timing_helper_never_logs_request_or_secret_fields(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes._timed)
        # The docstring explains what NOT to log (mentions "tokens" etc in
        # prose) -- check the actual logger.info call args, not the whole
        # function source, so this test can't be fooled by comments either
        # way.
        log_call = src[src.index("logger.info("):]
        for banned in ("token", "secret", "password", "jwt", "cookie"):
            assert banned not in log_call.lower()


class TestVercelFunctionRegion:
    def test_functions_run_near_the_database(self):
        import json

        config_path = BACKEND.parent / "vercel.json"
        data = json.loads(config_path.read_text())
        # Supabase project is ap-south-1 (Mumbai); bom1 is Vercel's matching
        # region. Running the API far from its own database (previously the
        # implicit default, iad1/US-East) was the single biggest latency
        # source measured in the admin performance audit.
        assert data.get("regions") == ["bom1"]


class TestServerlessSafeConnectionPool:
    """Production hit EMAXCONNSESSION (Supavisor's session-mode pool of 15
    clients exhausted) -- each serverless cold start held onto its own idle
    QueuePool connections that never got released when the container froze.
    NullPool means the app never holds an idle connection between requests."""

    def test_engine_uses_nullpool_not_a_resident_pool(self):
        import inspect

        src = inspect.getsource(db.get_engine)
        assert "NullPool" in src
        assert "pool_size" not in src
        assert "max_overflow" not in src

    def test_engine_disables_asyncpg_statement_cache(self):
        import inspect

        src = inspect.getsource(db.get_engine)
        # Required for transaction-mode pgbouncer/Supavisor compatibility;
        # harmless no-op against session mode or a direct connection.
        assert "statement_cache_size" in src
        assert "0" in src

    def test_engine_creation_log_never_includes_the_db_url(self):
        import inspect

        src = inspect.getsource(db.get_engine)
        # The log call should reference the safe describer function, never
        # the raw url/connection string itself.
        log_call = src[src.index("logger.info("):]
        assert "_describe_pooler_port(url)" in log_call

    def test_describe_pooler_port_never_leaks_credentials(self):
        described = db._describe_pooler_port(
            "postgresql+asyncpg://postgres.abc:supersecret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
        )
        assert "supersecret" not in described
        assert "postgres.abc" not in described
        assert "transaction-mode" in described

    def test_describe_pooler_port_flags_session_mode(self):
        described = db._describe_pooler_port(
            "postgresql+asyncpg://postgres.abc:x@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
        )
        assert "session-mode" in described

    def test_health_supabase_route_logs_duration_not_the_error_object_only(self):
        import inspect

        import app as app_module
        src = inspect.getsource(app_module.health_supabase)
        assert "duration_ms" in src


class TestAdminQuickSearch:
    def test_search_route_registered_and_protected(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        assert any(p == "/api/admin/search" and "GET" in m for p, m in routes)
        # The whole admin_routes router requires get_current_admin -- confirm
        # this route wasn't registered on some other, unprotected router.
        import admin_routes
        assert admin_routes.router.dependencies, "admin router must stay auth-protected"

    def test_search_repos_accept_q_and_are_capped(self):
        import inspect

        from repositories.customers_repo import CustomersRepository
        from repositories.orders_repo import OrdersRepository
        from repositories.products_repo import ProductsRepository
        from repositories.repairs_repo import RepairsRepository

        for repo, method in (
            (CustomersRepository, "search"), (OrdersRepository, "list"),
            (RepairsRepository, "list"), (ProductsRepository, "list"),
        ):
            sig = inspect.signature(getattr(repo, method))
            assert "q" in sig.parameters, f"{repo.__name__}.{method}"
            assert "limit" in sig.parameters, f"{repo.__name__}.{method}"

    def test_repairs_search_pushes_to_sql_not_python(self):
        import inspect

        from repositories.repairs_repo import RepairsRepository
        src = inspect.getsource(RepairsRepository.list)
        assert "_search_filter(q)" in src

    def test_search_route_returns_all_four_groups(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.admin_search)
        for group in ("customers", "orders", "repairs", "products"):
            assert f'"{group}"' in src

    def test_search_serializers_never_expose_cost_price_or_notes(self):
        import inspect

        import admin_routes
        for fn in (admin_routes._search_customer, admin_routes._search_product):
            src = inspect.getsource(fn)
            return_line = src[src.index("return"):]
            assert "cost_price" not in return_line
            assert "notes" not in return_line
            assert "address" not in return_line

    def test_search_route_is_timed(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.admin_search)
        assert "_timed(" in src

    def test_blank_query_short_circuits_without_hitting_the_db(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.admin_search)
        # An empty/blank q should return empty groups before any repo call.
        assert 'if not q:' in src.replace("  ", " ") or "if not q:" in src

    def test_search_includes_bills_group(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.admin_search)
        assert '"bills"' in src
        assert "BillArchivesRepository" in src


class TestBillArchive:
    def test_model_registered(self):
        assert hasattr(models, "BillArchive")
        assert models.BillArchive.__tablename__ == "bill_archives"

    def test_repository_registered(self):
        assert hasattr(repos, "BillArchivesRepository")

    def test_repo_list_and_count_accept_search_and_filters(self):
        import inspect

        from repositories.bill_archives_repo import BillArchivesRepository
        for method in ("list", "count"):
            sig = inspect.signature(getattr(BillArchivesRepository, method))
            for param in ("q", "payment_status", "start_date", "end_date"):
                assert param in sig.parameters, f"{method}({param})"
        assert "limit" in inspect.signature(BillArchivesRepository.list).parameters
        assert "offset" in inspect.signature(BillArchivesRepository.list).parameters

    def test_repo_search_joins_orders_and_repairs_for_linked_lookup(self):
        import inspect

        from repositories.bill_archives_repo import BillArchivesRepository
        src = inspect.getsource(BillArchivesRepository._base_query)
        assert "outerjoin" in src
        assert "Order" in src
        assert "RepairJob" in src

    def test_routes_registered_and_protected(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (
            ("GET", "/api/admin/bills"), ("POST", "/api/admin/bills"),
            ("GET", "/api/admin/bills/{bill_id}"), ("PUT", "/api/admin/bills/{bill_id}"),
        ):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"
        import admin_routes
        assert admin_routes.router.dependencies, "admin router must stay auth-protected"

    def test_list_route_is_bounded_and_timed(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.list_bills)
        assert "_timed(" in src
        assert "min(limit" in src

    def test_search_serializer_excludes_notes_and_photo_path(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes._search_bill)
        return_line = src[src.index("return"):]
        assert "notes" not in return_line
        assert "image_path" not in return_line

    def test_full_serializer_uses_the_photo_proxy_not_a_signed_url(self):
        # Supabase's /object/sign endpoint has been observed to fail 100% of
        # the time when routed through their Mumbai/BOM storage edge, which
        # is where this backend (Vercel region bom1) always lands. The photo
        # URL must be our own admin-auth-protected proxy route, not a
        # Supabase-minted signed URL.
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes._bill)
        assert "/admin/bills/" in src and "/photo" in src
        assert "_signed_storage_url" not in src

    def test_create_route_requires_a_photo(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.create_bill)
        assert "image_path" in src
        assert "400" in src

    def test_payment_status_is_validated(self):
        import admin_routes
        assert admin_routes._validate_bill_payment_status("paid") is None
        assert admin_routes._validate_bill_payment_status(None) is None
        try:
            admin_routes._validate_bill_payment_status("bogus")
            assert False, "expected HTTPException for an invalid payment status"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 400

    def test_photo_proxy_bucket_allowlist_rejects_anything_else(self):
        import asyncio

        import admin_routes
        assert admin_routes.ALLOWED_PRIVATE_PHOTO_BUCKETS == {"bill-photos", "repair-photos", "lead-photos"}
        # A bucket outside the allowlist must be refused before any network
        # call is made -- not just relying on every caller passing a safe
        # literal.
        result = asyncio.run(admin_routes._download_storage_object("some-other-bucket", "x.jpg"))
        assert result is None

    def test_photo_proxy_downloads_the_object_directly_not_via_sign_endpoint(self, monkeypatch):
        import asyncio

        import admin_routes

        captured = {}

        class _OkResponse:
            headers = {"content-type": "image/jpeg"}
            content = b"fake-jpeg-bytes"

            def raise_for_status(self):
                pass

        class _OkClient:
            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def get(self, url, headers=None):
                captured["url"] = url
                return _OkResponse()

        monkeypatch.setattr(admin_routes.config, "SUPABASE_URL", "https://example.supabase.co")
        monkeypatch.setattr(admin_routes.config, "SUPABASE_SERVICE_ROLE_KEY", "test-key")
        monkeypatch.setattr(admin_routes.httpx, "AsyncClient", lambda **kw: _OkClient())
        result = asyncio.run(admin_routes._download_storage_object("bill-photos", "bills/x.jpg"))
        assert result == (b"fake-jpeg-bytes", "image/jpeg")
        assert "/object/sign/" not in captured["url"]
        assert captured["url"].endswith("/object/bill-photos/bills/x.jpg")

    def test_photo_proxy_response_sanitizes_content_type_and_sets_private_cache(self):
        import admin_routes
        resp = admin_routes._photo_proxy_response((b"data", "image/png"))
        assert resp.media_type == "image/png"
        assert resp.headers["cache-control"] == "private, max-age=60"

    def test_photo_proxy_response_returns_502_when_download_fails(self):
        import admin_routes
        try:
            admin_routes._photo_proxy_response(None)
            assert False, "expected HTTPException for a failed download"
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 502

    def test_photo_routes_registered_and_protected(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (
            ("GET", "/api/admin/bills/{bill_id}/photo"),
            ("GET", "/api/admin/repairs/{rid}/photo"),
            ("GET", "/api/admin/leads/{lid}/photo"),
        ):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

    def test_repair_photo_route_validates_photo_type(self):
        import inspect

        import admin_routes
        src = inspect.getsource(admin_routes.repair_photo)
        assert "REPAIR_PHOTO_SLOTS" in src
        assert "400" in src

    def test_bill_photo_route_only_serves_that_bills_own_photo(self):
        # The route must look the bill up by the id in the URL and use only
        # that record's own image_path -- there is no "path" request
        # parameter a caller could supply to reach a different object.
        import inspect

        import admin_routes
        sig = inspect.signature(admin_routes.bill_photo)
        assert "path" not in sig.parameters
        assert "bucket" not in sig.parameters
        src = inspect.getsource(admin_routes.bill_photo)
        assert "bill.image_path" in src
        assert "404" in src


class TestBillArchivesMigration:
    def test_migration_file_exists_and_covers_required_columns(self):
        migrations_dir = BACKEND.parent / "supabase" / "migrations"
        matches = list(migrations_dir.glob("*bill_archives*.sql"))
        assert matches, "expected a bill_archives migration file"
        sql = matches[0].read_text()
        for column in (
            "bill_number", "customer_name", "customer_phone", "bill_date",
            "total_amount", "payment_status", "related_order_id", "related_repair_id",
            "related_customer_id", "image_path", "notes",
        ):
            assert column in sql, column
        for index_col in ("customer_phone", "customer_name", "bill_number", "bill_date",
                          "related_order", "related_repair"):
            assert index_col in sql, f"missing index on {index_col}"
        assert "bill-photos" in sql
        assert "enable row level security" in sql

    def test_bucket_limits_migration_caps_size_and_type(self):
        migrations_dir = BACKEND.parent / "supabase" / "migrations"
        matches = list(migrations_dir.glob("*bill_photos_bucket_limits*.sql"))
        assert matches, "expected a bill-photos bucket limits migration file"
        sql = matches[0].read_text()
        assert "bill-photos" in sql
        assert "file_size_limit" in sql
        assert "image/jpeg" in sql and "image/png" in sql and "image/webp" in sql

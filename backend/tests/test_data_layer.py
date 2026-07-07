"""S2 data-layer checks (server-less; no live DB required).

Run: REACT_APP_BACKEND_URL=x pytest backend/tests/test_data_layer.py
(the env var only satisfies the existing Mongo conftest.)
"""
import py_compile
import sys
from pathlib import Path

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
                     "AdminTask", "MaterialTask", "WhatsappTemplate"):
            assert hasattr(models, name), name

    def test_all_repositories_present(self):
        for name in ("SettingsRepository", "CategoriesRepository", "CollectionsRepository",
                     "RatesRepository", "ProductsRepository", "CustomersRepository",
                     "OrdersRepository", "PaymentsRepository", "RepairsRepository",
                     "LeadsRepository", "AdminTasksRepository", "MaterialTasksRepository",
                     "TemplatesRepository"):
            assert hasattr(repos, name), name


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

    def test_admin_payment_routes_registered(self):
        import app
        routes = [(r.path, tuple(sorted(getattr(r, "methods", []) or [])))
                  for r in app.app.routes]
        for method, path in (("GET", "/api/admin/orders/{oid}/payments"),
                             ("POST", "/api/admin/orders/{oid}/payments")):
            assert any(p == path and method in m for p, m in routes), f"{method} {path}"

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

"""
backend/tests/test_data_layer.py
Unit tests for the Supabase repository layer.

These tests run against a real Supabase project (or a local Supabase CLI
instance). They are skipped automatically when SUPABASE_URL / SUPABASE_SERVICE_KEY
are not set, so CI/CD without Supabase credentials stays green.

Run manually:
    cd backend
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... pytest tests/test_data_layer.py -v -n 0

Python 3.9 compatible.
"""
from __future__ import annotations

import os
import sys
import datetime
import pytest

# ---------------------------------------------------------------------------
# Skip entire module if Supabase env vars are missing
# ---------------------------------------------------------------------------
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")

pytestmark = pytest.mark.skipif(
    not (SUPABASE_URL and SUPABASE_KEY),
    reason="SUPABASE_URL and SUPABASE_SERVICE_KEY not set — skipping data-layer tests",
)

# ---------------------------------------------------------------------------
# Add backend/ to path so relative imports work when pytest is invoked from
# the repo root.
# ---------------------------------------------------------------------------
_BACKEND = os.path.join(os.path.dirname(__file__), "..")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)


# ---------------------------------------------------------------------------
# Imports (deferred so missing package doesn't break the skip logic above)
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def _check_imports():
    try:
        import supabase  # noqa: F401
    except ImportError:
        pytest.skip("supabase-py not installed — run: pip install supabase")


# ===========================================================================
# SettingsRepo
# ===========================================================================
class TestSettingsRepo:
    def test_get_returns_shop_settings(self):
        from repositories.settings_repo import SettingsRepo

        settings = SettingsRepo.get()
        assert settings.id == "shop"
        assert settings.shop_name  # non-empty string

    def test_update_roundtrip(self):
        from repositories.settings_repo import SettingsRepo

        original = SettingsRepo.get()
        new_tagline = f"Test tagline {datetime.datetime.utcnow().isoformat()}"

        updated = SettingsRepo.update({"tagline": new_tagline})
        assert updated.tagline == new_tagline

        # Restore
        SettingsRepo.update({"tagline": original.tagline})


# ===========================================================================
# RatesRepo
# ===========================================================================
class TestRatesRepo:
    TODAY = datetime.date.today()

    def test_upsert_and_get_by_date(self):
        from repositories.rates_repo import RatesRepo

        row = RatesRepo.upsert({
            "date_ad": self.TODAY,
            "gold_24k": 145000.0,
            "gold_22k": 132870.0,
            "silver": 1850.0,
        })
        assert row.gold_24k == 145000.0

        fetched = RatesRepo.get_by_date(self.TODAY)
        assert fetched is not None
        assert fetched.gold_22k == 132870.0

    def test_get_latest(self):
        from repositories.rates_repo import RatesRepo

        latest = RatesRepo.get_latest()
        assert latest is not None

    def test_list_recent(self):
        from repositories.rates_repo import RatesRepo

        rows = RatesRepo.list_recent(limit=5)
        assert isinstance(rows, list)


# ===========================================================================
# CustomersRepo
# ===========================================================================
class TestCustomersRepo:
    _created_id: str = ""

    def test_create(self):
        from repositories.customers_repo import CustomersRepo

        c = CustomersRepo.create({
            "name": "Test Customer",
            "phone": "9800000001",
            "address": "Test Address",
        })
        assert c.id
        TestCustomersRepo._created_id = c.id

    def test_get(self):
        from repositories.customers_repo import CustomersRepo

        assert TestCustomersRepo._created_id, "depends on test_create"
        c = CustomersRepo.get(TestCustomersRepo._created_id)
        assert c is not None
        assert c.name == "Test Customer"

    def test_search_by_phone(self):
        from repositories.customers_repo import CustomersRepo

        results = CustomersRepo.search_by_phone("9800000001")
        assert any(r.id == TestCustomersRepo._created_id for r in results)

    def test_update(self):
        from repositories.customers_repo import CustomersRepo

        assert TestCustomersRepo._created_id
        c = CustomersRepo.update(TestCustomersRepo._created_id, {"address": "Updated Address"})
        assert c is not None
        assert c.address == "Updated Address"

    def test_soft_delete(self):
        from repositories.customers_repo import CustomersRepo

        assert TestCustomersRepo._created_id
        ok = CustomersRepo.soft_delete(TestCustomersRepo._created_id)
        assert ok
        # Verify it's gone from active list
        c = CustomersRepo.get(TestCustomersRepo._created_id)
        assert c is None


# ===========================================================================
# ProductsRepo
# ===========================================================================
class TestProductsRepo:
    _created_id: str = ""

    def test_create(self):
        from repositories.products_repo import ProductsRepo

        p = ProductsRepo.create({
            "name": "Test Earring",
            "metal": "gold",
            "purity": "22K",
            "weight_grams": 3.5,
        })
        assert p.id
        assert p.product_code.startswith("JSD-P-")
        TestProductsRepo._created_id = p.id

    def test_get(self):
        from repositories.products_repo import ProductsRepo

        assert TestProductsRepo._created_id
        p = ProductsRepo.get(TestProductsRepo._created_id)
        assert p is not None
        assert p.name == "Test Earring"

    def test_update(self):
        from repositories.products_repo import ProductsRepo

        assert TestProductsRepo._created_id
        p = ProductsRepo.update(TestProductsRepo._created_id, {"status": "sold"})
        assert p is not None
        assert p.status == "sold"

    def test_soft_delete(self):
        from repositories.products_repo import ProductsRepo

        assert TestProductsRepo._created_id
        ok = ProductsRepo.soft_delete(TestProductsRepo._created_id)
        assert ok


# ===========================================================================
# OrdersRepo + PaymentsRepo
# ===========================================================================
class TestOrdersAndPayments:
    _customer_id: str = ""
    _order_id: str = ""
    _payment_id: str = ""

    def test_setup_customer(self):
        from repositories.customers_repo import CustomersRepo

        c = CustomersRepo.create({
            "name": "Order Test Customer",
            "phone": "9811111111",
        })
        TestOrdersAndPayments._customer_id = c.id

    def test_create_order(self):
        from repositories.orders_repo import OrdersRepo

        assert TestOrdersAndPayments._customer_id
        o = OrdersRepo.create({
            "customer_id": TestOrdersAndPayments._customer_id,
            "customer_name": "Order Test Customer",
            "customer_phone": "9811111111",
            "items": [{"name": "Ring", "price": 50000}],
            "total_price": 50000,
            "net_payable": 50000,
        })
        assert o.order_number.startswith("ORD-")
        TestOrdersAndPayments._order_id = o.id

    def test_get_order(self):
        from repositories.orders_repo import OrdersRepo

        assert TestOrdersAndPayments._order_id
        o = OrdersRepo.get(TestOrdersAndPayments._order_id)
        assert o is not None

    def test_create_payment(self):
        from repositories.payments_repo import PaymentsRepo

        assert TestOrdersAndPayments._order_id
        p = PaymentsRepo.create({
            "order_id": TestOrdersAndPayments._order_id,
            "customer_id": TestOrdersAndPayments._customer_id,
            "amount": 10000,
            "method": "cash",
        })
        assert p.id
        TestOrdersAndPayments._payment_id = p.id

    def test_list_payments_by_order(self):
        from repositories.payments_repo import PaymentsRepo

        assert TestOrdersAndPayments._order_id
        pmts = PaymentsRepo.list_by_order(TestOrdersAndPayments._order_id)
        assert any(p.id == TestOrdersAndPayments._payment_id for p in pmts)

    def test_teardown(self):
        from repositories.payments_repo import PaymentsRepo
        from repositories.orders_repo import OrdersRepo
        from repositories.customers_repo import CustomersRepo

        if TestOrdersAndPayments._payment_id:
            PaymentsRepo.delete(TestOrdersAndPayments._payment_id)
        if TestOrdersAndPayments._order_id:
            OrdersRepo.soft_delete(TestOrdersAndPayments._order_id)
        if TestOrdersAndPayments._customer_id:
            CustomersRepo.soft_delete(TestOrdersAndPayments._customer_id)


# ===========================================================================
# InvoicesRepo
# ===========================================================================
class TestInvoicesRepo:
    _customer_id: str = ""
    _order_id: str = ""
    _invoice_id: str = ""

    def test_setup(self):
        from repositories.customers_repo import CustomersRepo
        from repositories.orders_repo import OrdersRepo

        c = CustomersRepo.create({"name": "Invoice Customer", "phone": "9822222222"})
        TestInvoicesRepo._customer_id = c.id

        o = OrdersRepo.create({
            "customer_id": c.id,
            "customer_name": c.name,
            "customer_phone": c.phone,
            "items": [],
            "total_price": 75000,
            "net_payable": 75000,
        })
        TestInvoicesRepo._order_id = o.id

    def test_create_invoice(self):
        from repositories.invoices_repo import InvoicesRepo

        assert TestInvoicesRepo._order_id
        inv = InvoicesRepo.create({
            "bill_number": "TEST-INV-001",
            "order_id": TestInvoicesRepo._order_id,
            "order_number": "ORD-XXXX",
            "customer_snapshot": {"name": "Invoice Customer", "phone": "9822222222"},
            "items": [],
            "total_price": 75000,
            "net_payable": 75000,
        })
        assert inv.id
        assert inv.bill_number == "TEST-INV-001"
        TestInvoicesRepo._invoice_id = inv.id

    def test_get_by_bill_number(self):
        from repositories.invoices_repo import InvoicesRepo

        inv = InvoicesRepo.get_by_bill_number("TEST-INV-001")
        assert inv is not None

    def test_cancel_invoice(self):
        from repositories.invoices_repo import InvoicesRepo

        assert TestInvoicesRepo._invoice_id
        ok = InvoicesRepo.cancel(TestInvoicesRepo._invoice_id)
        assert ok

    def test_teardown(self):
        from repositories.invoices_repo import InvoicesRepo
        from repositories.orders_repo import OrdersRepo
        from repositories.customers_repo import CustomersRepo

        if TestInvoicesRepo._invoice_id:
            InvoicesRepo.soft_delete(TestInvoicesRepo._invoice_id)
        if TestInvoicesRepo._order_id:
            OrdersRepo.soft_delete(TestInvoicesRepo._order_id)
        if TestInvoicesRepo._customer_id:
            CustomersRepo.soft_delete(TestInvoicesRepo._customer_id)


# ===========================================================================
# RepairsRepo
# ===========================================================================
class TestRepairsRepo:
    _customer_id: str = ""
    _repair_id: str = ""

    def test_setup(self):
        from repositories.customers_repo import CustomersRepo

        c = CustomersRepo.create({"name": "Repair Customer", "phone": "9833333333"})
        TestRepairsRepo._customer_id = c.id

    def test_create(self):
        from repositories.repairs_repo import RepairsRepo

        assert TestRepairsRepo._customer_id
        r = RepairsRepo.create({
            "customer_id": TestRepairsRepo._customer_id,
            "customer_name": "Repair Customer",
            "customer_phone": "9833333333",
            "description": "Broken chain",
            "charge": 500,
        })
        assert r.repair_number.startswith("REP-")
        TestRepairsRepo._repair_id = r.id

    def test_update_status(self):
        from repositories.repairs_repo import RepairsRepo

        assert TestRepairsRepo._repair_id
        r = RepairsRepo.update(TestRepairsRepo._repair_id, {"status": "completed"})
        assert r is not None
        assert r.status == "completed"

    def test_teardown(self):
        from repositories.repairs_repo import RepairsRepo
        from repositories.customers_repo import CustomersRepo

        if TestRepairsRepo._repair_id:
            RepairsRepo.soft_delete(TestRepairsRepo._repair_id)
        if TestRepairsRepo._customer_id:
            CustomersRepo.soft_delete(TestRepairsRepo._customer_id)


# ===========================================================================
# CertificatesRepo
# ===========================================================================
class TestCertificatesRepo:
    _cert_id: str = ""

    def test_create(self):
        from repositories.certificates_repo import CertificatesRepo

        c = CertificatesRepo.create({
            "metal": "gold",
            "purity": "22K",
            "weight_grams": 5.0,
            "weight_tola": round(5.0 / 11.664, 4),
        })
        assert c.certificate_number.startswith("CERT-")
        TestCertificatesRepo._cert_id = c.id

    def test_get(self):
        from repositories.certificates_repo import CertificatesRepo

        assert TestCertificatesRepo._cert_id
        c = CertificatesRepo.get(TestCertificatesRepo._cert_id)
        assert c is not None

    def test_teardown(self):
        from repositories.certificates_repo import CertificatesRepo

        if TestCertificatesRepo._cert_id:
            CertificatesRepo.soft_delete(TestCertificatesRepo._cert_id)


# ===========================================================================
# LeadsRepo
# ===========================================================================
class TestLeadsRepo:
    _lead_id: str = ""

    def test_create(self):
        from repositories.leads_repo import LeadsRepo

        lead = LeadsRepo.create({
            "lead_type": "custom_order",
            "name": "Test Lead",
            "phone": "9844444444",
            "notes": "Test enquiry",
        })
        assert lead.id
        TestLeadsRepo._lead_id = lead.id

    def test_list_all(self):
        from repositories.leads_repo import LeadsRepo

        leads = LeadsRepo.list_all()
        assert any(l.id == TestLeadsRepo._lead_id for l in leads)

    def test_update_status(self):
        from repositories.leads_repo import LeadsRepo

        assert TestLeadsRepo._lead_id
        lead = LeadsRepo.update_status(TestLeadsRepo._lead_id, "contacted")
        assert lead is not None
        assert lead.status == "contacted"

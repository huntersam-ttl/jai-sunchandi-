"""Regression guards for the financial locking and RLS migration.

These static checks supplement (not replace) PostgreSQL integration tests.
"""
from pathlib import Path
import inspect

ROOT = Path(__file__).resolve().parents[2]


def test_order_reservation_is_conditional():
    from repositories.orders_repo import OrdersRepository
    source = inspect.getsource(OrdersRepository.create_order)
    assert 'Product.status == "available"' in source
    assert "Product.is_deleted.is_(False)" in source
    assert ".returning(Product.id)" in source
    assert "already reserved" in source
    assert "sorted(product_ids, key=str)" in source


def test_payment_endpoint_locks_parent_order():
    import admin_routes
    source = inspect.getsource(admin_routes.add_order_payment)
    assert ".with_for_update()" in source
    assert source.index(".with_for_update()") < source.index(".add_payment(")


def test_payment_rejects_overpayment():
    from repositories.payments_repo import PaymentsRepository
    source = inspect.getsource(PaymentsRepository.add_payment)
    assert "Payment exceeds the remaining balance" in source
    assert "total_paid" in source


def test_rls_requires_enrolled_admin():
    migration = (ROOT / "supabase/migrations/0014_admin_membership_rls.sql").read_text()
    assert "shop_admin_self_read" in migration
    assert "auth.uid()" in migration
    assert "drop policy if exists admin_all" in migration
    assert "admin_manage_bill_photos" in migration
    assert "admin_manage_buckets" in migration

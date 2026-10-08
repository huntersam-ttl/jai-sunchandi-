"""Opt-in PostgreSQL integration tests for financial and inventory races.

These tests intentionally require TEST_POSTGRES_URL rather than the application's
SUPABASE_DB_URL. The database must be a disposable instance with the repository
migrations already applied. Without that explicit test URL, pytest skips the
module instead of silently testing a mock or production database.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid
from urllib.parse import urlparse

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

BACKEND = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, BACKEND)

TEST_URL = os.getenv("TEST_POSTGRES_URL", "").strip()
if not TEST_URL:
    pytest.skip("TEST_POSTGRES_URL is not configured", allow_module_level=True)
if TEST_URL.startswith("postgresql://"):
    TEST_URL = "postgresql+asyncpg://" + TEST_URL[len("postgresql://"):]

parsed = urlparse(TEST_URL)
if parsed.hostname in {"db.supabase.co", "supabase.co"} or parsed.hostname and parsed.hostname.endswith(".supabase.co"):
    pytest.fail("TEST_POSTGRES_URL must point to a disposable local test database")

from models import Customer, Order, OrderItem, Payment, Product  # noqa: E402
from repositories import OrdersRepository, PaymentsRepository  # noqa: E402

engine = create_async_engine(TEST_URL, poolclass=NullPool, connect_args={"statement_cache_size": 0})
Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def _seed(*, product_count: int = 1) -> dict[str, list[str] | str]:
    customer_id = str(uuid.uuid4())
    product_ids = [str(uuid.uuid4()) for _ in range(product_count)]
    async with Session.begin() as session:
        await session.execute(text("""
            insert into customers (id, name, phone, address, notes)
            values (:id, :name, :phone, '', '')
        """), {"id": customer_id, "name": f"Concurrency {customer_id[:8]}",
                "phone": f"9{customer_id.replace('-', '')[:9]}"})
        for product_id in product_ids:
            await session.execute(text("""
                insert into products (
                    id, name, name_np, description, category, collection, metal, purity,
                    weight_grams, jarti_percent, jyala_amount, jyala_type, stone_cost,
                    polishing_cost, cutting_cost, worker_charge, other_cost, status,
                    show_on_website, show_price_on_website, photos
                ) values (
                    :id, 'Concurrency ring', '', '', 'Rings', 'Daily Wear', 'gold', '22K',
                    1.000, 0, 0, 'flat', 0, 0, 0, 0, 0, 'available', false, false, '{}'
                )
            """), {"id": product_id})
    return {"customer_id": customer_id, "product_ids": product_ids}


async def _cleanup(data: dict[str, list[str] | str]) -> None:
    async with Session.begin() as session:
        await session.execute(text("delete from payments where customer_id = :id"), {"id": data["customer_id"]})
        await session.execute(text("delete from order_items where order_id in (select id from orders where customer_id = :id)"), {"id": data["customer_id"]})
        await session.execute(text("delete from orders where customer_id = :id"), {"id": data["customer_id"]})
        await session.execute(
            text("delete from products where id = any(cast(:ids as uuid[]))"),
            {"ids": data["product_ids"]},
        )
        await session.execute(text("delete from customers where id = :id"), {"id": data["customer_id"]})


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture
def seeded():
    data = _run(_seed())
    try:
        yield data
    finally:
        _run(_cleanup(data))


def _item(product_id: str) -> dict:
    return {
        "product_id": product_id, "name": "Concurrency ring", "metal": "gold",
        "purity": "22K", "weight_grams": 1, "rate_per_tola": 100000,
        "jarti_percent": 0, "jyala_amount": 0, "jyala_type": "flat",
        "stone_cost": 0, "polishing_cost": 0, "cutting_cost": 0,
        "worker_charge": 0, "other_cost": 0, "discount": 0,
    }


async def _create_order(data, product_ids: list[str]) -> tuple[bool, str | None]:
    async with Session() as session:
        customer = await session.get(Customer, data["customer_id"])
        try:
            order = await OrdersRepository(session).create_order(
                customer=customer, items=[_item(product_id) for product_id in product_ids]
            )
            await session.commit()
            return True, str(order.id)
        except ValueError:
            await session.rollback()
            return False, None


def test_competing_orders_only_one_can_reserve_product(seeded):
    async def run():
        product_id = seeded["product_ids"][0]
        results = await asyncio.gather(
            _create_order(seeded, [product_id]), _create_order(seeded, [product_id])
        )
        return results

    results = _run(run())
    assert sum(ok for ok, _ in results) == 1
    async def verify():
        async with Session() as session:
            status = await session.scalar(text("select status from products where id = :id"), {"id": seeded["product_ids"][0]})
            count = await session.scalar(text("select count(*) from orders where customer_id = :id"), {"id": seeded["customer_id"]})
            return status, count
    assert _run(verify()) == ("reserved", 1)


def test_overlapping_reservations_finish_without_deadlock(seeded):
    async def run():
        extra = await _seed(product_count=2)
        try:
            ids = extra["product_ids"]
            results = await asyncio.wait_for(asyncio.gather(
                _create_order(extra, ids), _create_order(extra, list(reversed(ids)))
            ), timeout=5)
            return results
        finally:
            await _cleanup(extra)

    results = _run(run())
    assert sum(ok for ok, _ in results) == 1


async def _pay(data, order_id: str, amount) -> tuple[bool, str | None]:
    async with Session() as session:
        try:
            order = (await session.execute(
                text("select id from orders where id = :id for update"), {"id": order_id}
            )).first()
            if not order:
                return False, "missing order"
            orm_order = await session.get(Order, order_id)
            await PaymentsRepository(session).add_payment(order=orm_order, amount=amount)
            await session.commit()
            return True, None
        except ValueError as exc:
            await session.rollback()
            return False, str(exc)


def test_concurrent_payments_preserve_balance(seeded):
    async def run():
        ok, order_id = await _create_order(seeded, [])
        assert ok
        async with Session.begin() as session:
            await session.execute(text("update orders set net_payable = 100.00, total_price = 100.00, remaining_balance = 100.00 where id = :id"), {"id": order_id})
        return order_id, await asyncio.gather(_pay(seeded, order_id, 60), _pay(seeded, order_id, 60))

    order_id, results = _run(run())
    assert sum(ok for ok, _ in results) == 1
    async def verify():
        async with Session() as session:
            return await session.execute(text("select advance_total, remaining_balance, payment_status from orders where id = :id"), {"id": order_id})
    row = _run(verify()).one()
    assert tuple(row) == (60, 40, "partial")

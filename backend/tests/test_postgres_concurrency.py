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
from fulfilment import issue_pickup_pin  # noqa: E402

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


def test_failed_partial_reservation_rolls_back_prior_claims(seeded):
    async def run():
        extra = await _seed(product_count=2)
        try:
            async with Session.begin() as session:
                await session.execute(
                    text("update products set status = 'reserved' where id = :id"),
                    {"id": extra["product_ids"][1]},
                )
            ok, _ = await _create_order(extra, extra["product_ids"])
            async with Session() as session:
                statuses = (await session.execute(
                    text("select status from products where id = any(cast(:ids as uuid[])) order by id"),
                    {"ids": extra["product_ids"]},
                )).scalars().all()
                orders = await session.scalar(
                    text("select count(*) from orders where customer_id = :id"),
                    {"id": extra["customer_id"]},
                )
            return ok, statuses, orders
        finally:
            await _cleanup(extra)

    ok, statuses, orders = _run(run())
    assert not ok
    assert statuses.count("available") == 1
    assert statuses.count("reserved") == 1
    assert orders == 0


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


async def _set_payable(order_id: str, amount: str = "100.00") -> None:
    async with Session.begin() as session:
        await session.execute(
            text("update orders set net_payable = :amount, total_price = :amount, remaining_balance = :amount where id = :id"),
            {"amount": amount, "id": order_id},
        )


def test_two_concurrent_valid_payments_preserve_balance(seeded):
    async def run():
        ok, order_id = await _create_order(seeded, [])
        assert ok
        await _set_payable(order_id)
        return order_id, await asyncio.gather(_pay(seeded, order_id, 40), _pay(seeded, order_id, 50))

    order_id, results = _run(run())
    assert all(ok for ok, _ in results)
    async def verify():
        async with Session() as session:
            return await session.execute(text("select advance_total, remaining_balance, payment_status from orders where id = :id"), {"id": order_id})
    row = _run(verify()).one()
    assert tuple(row) == (90, 10, "partial")


def test_concurrent_payments_reject_overpayment(seeded):
    async def run():
        ok, order_id = await _create_order(seeded, [])
        assert ok
        await _set_payable(order_id)
        return order_id, await asyncio.gather(_pay(seeded, order_id, 60), _pay(seeded, order_id, 60))

    order_id, results = _run(run())
    assert sum(ok for ok, _ in results) == 1
    async def verify():
        async with Session() as session:
            return await session.execute(text("select advance_total, remaining_balance, payment_status from orders where id = :id"), {"id": order_id})
    assert tuple(_run(verify()).one()) == (60, 40, "partial")


def test_failed_payment_rolls_back_without_changing_balance(seeded):
    async def run():
        ok, order_id = await _create_order(seeded, [])
        assert ok
        await _set_payable(order_id)
        payment_result = await _pay(seeded, order_id, 150)
        async with Session() as session:
            row = (await session.execute(text("""
                select o.advance_total, o.remaining_balance, o.payment_status,
                       count(p.id) as payment_count
                from orders o left join payments p on p.order_id = o.id
                where o.id = :id
                group by o.id, o.advance_total, o.remaining_balance, o.payment_status
            """), {"id": order_id})).one()
        return payment_result, tuple(row)

    payment_result, row = _run(run())
    assert payment_result == (False, "Payment exceeds the remaining balance")
    assert row == (0, 100, "unpaid", 0)


def test_cancellation_releases_reserved_product(seeded):
    async def run():
        ok, order_id = await _create_order(seeded, [seeded["product_ids"][0]])
        assert ok
        async with Session() as session:
            order = await OrdersRepository(session).update_status(order_id, "cancelled")
            assert order is not None
            await session.commit()
        async with Session() as session:
            return await session.scalar(
                text("select status from products where id = :id"),
                {"id": seeded["product_ids"][0]},
            )

    assert _run(run()) == "available"


def test_concurrent_collection_only_one_confirmation_succeeds(seeded):
    async def prepare():
        ok, order_id = await _create_order(seeded, [])
        assert ok
        pin, encoded = issue_pickup_pin()
        async with Session.begin() as session:
            await session.execute(text("update orders set status = 'ready', pickup_pin_hash = :hash where id = :id"), {"hash": encoded, "id": order_id})
        return order_id, pin

    async def collect(order_id, pin):
        async with Session() as session:
            try:
                await OrdersRepository(session).confirm_collection(order_id, pin, "Mina Rai")
                await session.commit()
                return True, None
            except ValueError as exc:
                await session.rollback()
                return False, str(exc)

    async def run():
        order_id, pin = await prepare()
        results = await asyncio.gather(collect(order_id, pin), collect(order_id, pin))
        async with Session() as session:
            row = (await session.execute(text("select status, collected_at, collected_by_name, pickup_pin_hash from orders where id = :id"), {"id": order_id})).one()
        return results, tuple(row)

    results, row = _run(run())
    assert sum(ok for ok, _ in results) == 1
    assert row[0] == "collected"
    assert row[1] is not None
    assert row[2] == "Mina Rai"
    assert row[3] is None

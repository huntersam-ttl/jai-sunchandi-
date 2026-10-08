"""Orders repository. Builds frozen price snapshots via the shared pricing
engine (utils.compute_price) — the same formula the Mongo app used — so pricing
never diverges between stacks.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import noload

from models import Order, OrderItem, Product
from fulfilment import verify_pickup_pin
from utils import ad_to_bs, compute_price, GRAMS_PER_TOLA
from .base import BaseRepository, archived_clause, derive_payment_status


class OrdersRepository(BaseRepository):
    model = Order

    async def get(self, order_id) -> Order | None:
        return await self.session.get(Order, order_id)

    async def list(self, *, status=None, q=None, archived: str = "active",
                   limit: int | None = 50, offset: int = 0):
        # List views never need the item/payment lines -- noload() skips the
        # selectin fan-out that OrderDetail relies on, avoiding an N+1 on
        # every row for a page that only ever shows summary fields.
        stmt = select(Order).options(noload(Order.items), noload(Order.payments))
        clause = archived_clause(Order.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        if status:
            stmt = stmt.where(Order.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                Order.order_number.ilike(like)
                | Order.customer_name.ilike(like)
                | Order.customer_phone.ilike(like)
            )
        stmt = stmt.order_by(Order.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, *, status=None, q=None, archived: str = "active") -> int:
        stmt = select(func.count()).select_from(Order)
        clause = archived_clause(Order.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        if status:
            stmt = stmt.where(Order.status == status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                Order.order_number.ilike(like)
                | Order.customer_name.ilike(like)
                | Order.customer_phone.ilike(like)
            )
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def archive(self, order_id) -> Order | None:
        order = await self.get(order_id)
        if order is not None:
            order.is_deleted = True
            await self.session.flush()
        return order

    async def restore(self, order_id) -> Order | None:
        order = await self.get(order_id)
        if order is not None:
            order.is_deleted = False
            await self.session.flush()
        return order

    @staticmethod
    def _date_or_none(value) -> date | None:
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date() if "T" in value else date.fromisoformat(value)
        raise ValueError("Invalid date value")

    async def create_order(self, *, customer, items, order_type="purchase",
                           old_gold=None, custom_description="", delivery_date_ad=None,
                           delivery_time="", notes="", fulfilment=None,
                           collector_relationship="") -> Order:
        """Create an order with frozen item snapshots. `items` is a list of dicts
        of pricing inputs; `customer` is a Customer model."""
        total = 0.0
        order_items: list[OrderItem] = []
        for line_number, it in enumerate(items, start=1):
            snap = compute_price(
                it["weight_grams"], it["rate_per_tola"], it.get("purity", "24K"),
                it.get("jarti_percent", 0), it.get("jyala_amount", 0), it.get("jyala_type", "flat"),
                it.get("stone_cost", 0), it.get("polishing_cost", 0), it.get("cutting_cost", 0),
                it.get("worker_charge", 0), it.get("other_cost", 0), it.get("discount", 0),
            )
            order_items.append(OrderItem(
                product_id=it.get("product_id"), name=it["name"], metal=it.get("metal", "gold"),
                purity=snap["purity"], weight_grams=snap["weight_grams"], weight_tola=snap["weight_tola"],
                rate_per_tola=snap["rate_per_tola"], purity_factor=snap["purity_factor"],
                metal_value=snap["metal_value"], jarti_percent=snap["jarti_percent"],
                jarti_amount=snap["jarti_amount"], jyala_type=snap["jyala_type"],
                jyala_input=snap["jyala_input"], jyala_amount=snap["jyala_amount"],
                stone_cost=snap["stone_cost"], polishing_cost=snap["polishing_cost"],
                cutting_cost=snap["cutting_cost"], worker_charge=snap["worker_charge"],
                other_cost=snap["other_cost"], discount=snap["discount"], total_price=snap["total_price"],
                cost_price=it.get("cost_price"), line_number=line_number,
            ))
            total += snap["total_price"]

        old_value = 0.0
        og = None
        if old_gold and float(old_gold.get("old_weight_tola", 0) or 0) > 0:
            og = dict(old_gold)
            old_value = round(
                float(og["old_weight_tola"]) * float(og["old_valuation_rate_per_tola"])
                * (1 - float(og.get("old_deduction_percent", 0) or 0) / 100.0), 2)
            og["old_weight_grams"] = round(float(og["old_weight_tola"]) * GRAMS_PER_TOLA, 3)
            og["old_gold_value"] = old_value

        net = round(total - old_value, 2)
        today = date.today()
        delivery_date = self._date_or_none(delivery_date_ad)
        order_bs = ad_to_bs(today)
        delivery_bs = ad_to_bs(delivery_date) if delivery_date else {}

        order = Order(
            customer_id=customer.id, customer_name=customer.name, customer_phone=customer.phone,
            order_type=order_type, custom_description=custom_description, reference_photo_url="",
            order_date_ad=today, order_date_bs=order_bs["bs_date"], order_date_bs_np=order_bs["bs_date_np"],
            delivery_date_ad=delivery_date, delivery_date_bs=delivery_bs.get("bs_date"),
            delivery_date_bs_np=delivery_bs.get("bs_date_np"), delivery_time=delivery_time,
            status="new", notes=notes, old_gold=og,
            fulfilment_method=(fulfilment or {}).get("fulfilment_method", "self_collect"),
            fulfilment_country=(fulfilment or {}).get("country", "NP"),
            collector_name=(fulfilment or {}).get("collector_name", ""),
            collector_phone=(fulfilment or {}).get("collector_phone", ""),
            collector_relationship=collector_relationship,
            total_price=round(total, 2), old_gold_value=old_value, net_payable=net,
            advance_total=0, remaining_balance=net,
            payment_status=derive_payment_status(net, 0),
            items=order_items,
        )
        self.session.add(order)
        # Conditional UPDATE serializes claims and rejects unavailable products.
        # Always claim in UUID order: two orders containing the same products in
        # different line-item orders must acquire locks in the same order or
        # PostgreSQL can deadlock them.
        product_ids = [item.product_id for item in order_items if item.product_id]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("The same product cannot be reserved twice")
        for product_id in sorted(product_ids, key=str):
            result = await self.session.execute(
                update(Product)
                .where(Product.id == product_id, Product.status == "available",
                       Product.is_deleted.is_(False))
                .values(status="reserved")
                .returning(Product.id)
            )
            if result.scalar_one_or_none() is None:
                raise ValueError("Product is unavailable or already reserved")
        await self.session.flush()
        return order

    async def public_status(self, order_number: str, phone: str) -> Order | None:
        """Order status matching order_number + phone, excluding cancellation."""
        stmt = select(Order).where(
            Order.order_number == order_number,
            Order.customer_phone == phone,
            Order.is_deleted.is_(False),
            Order.status != "cancelled",
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    # These four are used by the dashboard (capped previews) and reports
    # (accurate totals, uncapped). `noload` skips eager-loading items/payments
    # -- neither caller needs the frozen line items or payment history, just
    # order-level summary columns, so this drops the N+1 selectin subqueries
    # entirely regardless of row count.
    async def due_today(self, *, limit: int | None = None) -> list[Order]:
        today = date.today()
        stmt = (select(Order).options(noload(Order.items), noload(Order.payments)).where(
            Order.is_deleted.is_(False), Order.status.notin_(["delivered", "cancelled"]),
            Order.delivery_date_ad == today,
        ).order_by(Order.created_at.desc()))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def due_this_week(self, *, limit: int | None = None) -> list[Order]:
        today = date.today()
        week_end = today + timedelta(days=7)
        stmt = (select(Order).options(noload(Order.items), noload(Order.payments)).where(
            Order.is_deleted.is_(False), Order.status.notin_(["delivered", "cancelled"]),
            Order.delivery_date_ad > today, Order.delivery_date_ad <= week_end,
        ).order_by(Order.delivery_date_ad.asc()))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def ready_for_collection(self, *, limit: int | None = None) -> list[Order]:
        stmt = (select(Order).options(noload(Order.items), noload(Order.payments))
                .where(Order.is_deleted.is_(False), Order.status == "ready")
                .order_by(Order.created_at.desc()))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def pending_payments(self, *, limit: int | None = None) -> list[Order]:
        stmt = (select(Order).options(noload(Order.items), noload(Order.payments)).where(
            Order.is_deleted.is_(False), Order.status != "cancelled", Order.remaining_balance > 0,
        ).order_by(Order.created_at.desc()))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def active_count(self) -> int:
        stmt = select(func.count()).select_from(Order).where(
            Order.is_deleted.is_(False), Order.status.notin_(["delivered", "cancelled"]))
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def update_status(self, order_id, status: str) -> Order | None:
        order = await self.get(order_id)
        if order is not None:
            order.status = status
            product_status = {"delivered": "sold", "collected": "sold", "cancelled": "available"}.get(status)
            if product_status:
                for item in order.items:
                    if item.product_id:
                        product = await self.session.get(Product, item.product_id)
                        if product is not None:
                            product.status = product_status
            await self.session.flush()
        return order

    async def confirm_collection(self, order_id, pickup_pin: str, collector_name: str) -> Order:
        """Atomically verify a one-use PIN and mark a ready order collected."""
        result = await self.session.execute(
            select(Order).where(Order.id == order_id).with_for_update()
        )
        order = result.scalar_one_or_none()
        if not order or order.is_deleted:
            raise ValueError("Order not found")
        if order.status == "collected" or order.collected_at is not None:
            raise ValueError("Order has already been collected")
        if order.status != "ready":
            raise ValueError("Only orders ready for collection can be collected")
        if not order.pickup_pin_hash or not verify_pickup_pin(pickup_pin, order.pickup_pin_hash):
            raise ValueError("Invalid pickup PIN")
        collector_name = (collector_name or "").strip()
        if not collector_name:
            raise ValueError("Collector name is required")
        order.status = "collected"
        order.collected_by_name = collector_name
        order.collected_at = datetime.now(timezone.utc)
        order.pickup_pin_hash = None
        for item in order.items:
            if item.product_id:
                product = await self.session.get(Product, item.product_id)
                if product is not None:
                    product.status = "sold"
        await self.session.flush()
        return order

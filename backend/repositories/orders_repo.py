"""Orders repository. Builds frozen price snapshots via the shared pricing
engine (utils.compute_price) — the same formula the Mongo app used — so pricing
never diverges between stacks.
"""
from __future__ import annotations

from datetime import date

from sqlalchemy import select

from models import Order, OrderItem
from utils import ad_to_bs, compute_price, GRAMS_PER_TOLA
from .base import BaseRepository, derive_payment_status


class OrdersRepository(BaseRepository):
    model = Order

    async def get(self, order_id) -> Order | None:
        return await self.session.get(Order, order_id)

    async def list(self, *, status=None):
        stmt = select(Order).where(Order.is_deleted.is_(False))
        if status:
            stmt = stmt.where(Order.status == status)
        stmt = stmt.order_by(Order.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_order(self, *, customer, items, order_type="purchase",
                           old_gold=None, custom_description="", delivery_date_ad=None,
                           delivery_time="", notes="") -> Order:
        """Create an order with frozen item snapshots. `items` is a list of dicts
        of pricing inputs; `customer` is a Customer model."""
        total = 0.0
        order_items: list[OrderItem] = []
        for it in items:
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
        today = date.today().isoformat()
        order_bs = ad_to_bs(today)
        delivery_bs = ad_to_bs(delivery_date_ad) if delivery_date_ad else {}

        order = Order(
            customer_id=customer.id, customer_name=customer.name, customer_phone=customer.phone,
            order_type=order_type, custom_description=custom_description, reference_photo_url="",
            order_date_ad=today, order_date_bs=order_bs["bs_date"], order_date_bs_np=order_bs["bs_date_np"],
            delivery_date_ad=delivery_date_ad, delivery_date_bs=delivery_bs.get("bs_date"),
            delivery_date_bs_np=delivery_bs.get("bs_date_np"), delivery_time=delivery_time,
            status="new", notes=notes, old_gold=og,
            total_price=round(total, 2), old_gold_value=old_value, net_payable=net,
            advance_total=0, remaining_balance=net,
            payment_status=derive_payment_status(net, 0),
            items=order_items,
        )
        self.session.add(order)
        await self.session.flush()
        return order

    async def public_status(self, order_number: str, phone: str) -> Order | None:
        """Active (non-delivered/cancelled) order matching order_number + phone."""
        stmt = select(Order).where(
            Order.order_number == order_number,
            Order.customer_phone == phone,
            Order.is_deleted.is_(False),
            Order.status.notin_(["delivered", "cancelled"]),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(self, order_id, status: str) -> Order | None:
        order = await self.get(order_id)
        if order is not None:
            order.status = status
            await self.session.flush()
        return order

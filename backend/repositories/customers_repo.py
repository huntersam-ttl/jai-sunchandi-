"""Customers repository, including the khata (outstanding) aggregation."""
from __future__ import annotations

from sqlalchemy import desc, or_, select

from models import Customer, Order, Payment, RepairJob
from .base import BaseRepository


class CustomersRepository(BaseRepository):
    model = Customer

    async def search(self, q: str | None = None):
        stmt = select(Customer).where(Customer.is_deleted.is_(False))
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Customer.name.ilike(like), Customer.phone.ilike(like)))
        stmt = stmt.order_by(Customer.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def profile(self, customer_id):
        """Customer + their orders, payments, repairs, and total outstanding."""
        customer = await self.get(customer_id)
        if customer is None:
            return None
        orders = (await self.session.execute(
            select(Order).where(Order.customer_id == customer_id)
            .order_by(Order.created_at.desc()))).scalars().all()
        payments = (await self.session.execute(
            select(Payment).where(Payment.customer_id == customer_id)
            .order_by(Payment.payment_date_ad.desc()))).scalars().all()
        repairs = (await self.session.execute(
            select(RepairJob).where(RepairJob.customer_id == customer_id)
            .order_by(RepairJob.created_at.desc()))).scalars().all()
        outstanding = sum(
            float(o.remaining_balance or 0) for o in orders if o.status != "cancelled")
        return {
            "customer": customer,
            "orders": list(orders),
            "payments": list(payments),
            "repairs": list(repairs),
            "total_outstanding": round(outstanding, 2),
        }

    async def dues(self):
        """Customer-level unpaid balance summary from existing order balances."""
        stmt = (
            select(Order, Customer)
            .join(Customer, Order.customer_id == Customer.id)
            .where(
                Customer.is_deleted.is_(False),
                Order.is_deleted.is_(False),
                Order.status != "cancelled",
                Order.remaining_balance > 0,
            )
            .order_by(desc(Order.order_date_ad), desc(Order.created_at))
        )
        result = await self.session.execute(stmt)
        grouped = {}
        for order, customer in result.all():
            cid = str(customer.id)
            row = grouped.setdefault(cid, {
                "customer": customer,
                "outstanding_balance": 0.0,
                "open_orders_count": 0,
                "latest_order": None,
            })
            row["outstanding_balance"] += float(order.remaining_balance or 0)
            row["open_orders_count"] += 1
            latest = row["latest_order"]
            if latest is None or order.order_date_ad > latest.order_date_ad:
                row["latest_order"] = order

        dues = list(grouped.values())
        for row in dues:
            row["outstanding_balance"] = round(row["outstanding_balance"], 2)
        return sorted(dues, key=lambda r: r["outstanding_balance"], reverse=True)

"""Customers repository, including the khata (outstanding) aggregation."""
from __future__ import annotations

from sqlalchemy import or_, select

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

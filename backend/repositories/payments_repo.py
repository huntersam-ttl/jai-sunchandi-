"""Payments repository + khata recompute.

Adding a payment and recomputing the parent order's advance/remaining/
payment_status happen in the same session (the caller's transaction), giving
atomic ledger updates — the integrity the Mongo version could not guarantee.
"""
from datetime import date

from sqlalchemy import func, select

from models import Order, Payment
from utils import ad_to_bs
from .base import BaseRepository, derive_payment_status


class PaymentsRepository(BaseRepository):
    model = Payment

    async def add_payment(self, *, order: Order, amount, method="cash",
                          payment_date_ad=None, note="") -> Payment:
        payment_date_ad = payment_date_ad or date.today().isoformat()
        bs = ad_to_bs(payment_date_ad)
        payment = Payment(
            order_id=order.id, customer_id=order.customer_id, amount=amount, method=method,
            payment_date_ad=payment_date_ad, payment_date_bs=bs["bs_date"],
            payment_date_bs_np=bs["bs_date_np"], note=note,
        )
        self.session.add(payment)
        await self.session.flush()
        await self.recompute_balances(order)
        return payment

    async def recompute_balances(self, order: Order) -> Order:
        """Recompute advance_total / remaining_balance / payment_status for an order."""
        total_paid = (await self.session.execute(
            select(func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.order_id == order.id))).scalar_one()
        advance = round(float(total_paid), 2)
        remaining = round(float(order.net_payable) - advance, 2)
        order.advance_total = advance
        order.remaining_balance = remaining
        order.payment_status = derive_payment_status(order.net_payable, advance)
        await self.session.flush()
        return order

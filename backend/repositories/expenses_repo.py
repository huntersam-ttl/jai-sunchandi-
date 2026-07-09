"""Expenses and cashbook repository.

Cashbook is cash movement only: existing order payments are cash-in and
expenses are cash-out. It intentionally does not calculate profit/loss.
"""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select

from models import Expense, Order, Payment
from .base import BaseRepository


class ExpensesRepository(BaseRepository):
    model = Expense

    @staticmethod
    def _date_or_today(value) -> date:
        if value in (None, ""):
            return date.today()
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date() if "T" in value else date.fromisoformat(value)
        raise ValueError("Invalid date value")

    @staticmethod
    def _date_or_none(value) -> date | None:
        if value in (None, ""):
            return None
        return ExpensesRepository._date_or_today(value)

    async def list(self, *, start_date=None, end_date=None,
                   limit: int | None = 100, offset: int = 0) -> list[Expense]:
        start = self._date_or_none(start_date)
        end = self._date_or_none(end_date)
        stmt = select(Expense)
        if start:
            stmt = stmt.where(Expense.date_ad >= start)
        if end:
            stmt = stmt.where(Expense.date_ad <= end)
        stmt = stmt.order_by(Expense.date_ad.desc(), Expense.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, expense_id) -> bool:
        """Expenses have no soft-delete column -- a mistaken entry is a
        genuine mistake to remove outright, not shop history to preserve."""
        expense = await self.get(expense_id)
        if expense is None:
            return False
        await self.session.delete(expense)
        await self.session.flush()
        return True

    def create(self, *, date_ad=None, category="other", description="",
               amount=0, payment_method="cash") -> Expense:
        expense = Expense(
            date_ad=self._date_or_today(date_ad),
            category=category or "other",
            description=description or "",
            amount=amount,
            payment_method=payment_method or "cash",
        )
        self.session.add(expense)
        return expense

    async def cashbook(self, *, start_date=None, end_date=None) -> dict:
        start = self._date_or_none(start_date)
        end = self._date_or_none(end_date)

        payment_stmt = select(Payment, Order).join(Order, Payment.order_id == Order.id)
        expense_stmt = select(Expense)
        if start:
            payment_stmt = payment_stmt.where(Payment.payment_date_ad >= start)
            expense_stmt = expense_stmt.where(Expense.date_ad >= start)
        if end:
            payment_stmt = payment_stmt.where(Payment.payment_date_ad <= end)
            expense_stmt = expense_stmt.where(Expense.date_ad <= end)

        payments = (await self.session.execute(payment_stmt)).all()
        expenses = (await self.session.execute(expense_stmt)).scalars().all()

        entries = []
        for payment, order in payments:
            amount = round(float(payment.amount or 0), 2)
            entries.append({
                "id": str(payment.id),
                "type": "cash_in",
                "date_ad": payment.payment_date_ad,
                "description": f"Order payment {order.order_number or ''}".strip(),
                "category": "order_payment",
                "payment_method": payment.method,
                "amount": amount,
                "cash_in": amount,
                "cash_out": 0.0,
                "order_id": str(order.id),
                "order_number": order.order_number,
                "customer_name": order.customer_name,
            })

        for expense in expenses:
            amount = round(float(expense.amount or 0), 2)
            entries.append({
                "id": str(expense.id),
                "type": "cash_out",
                "date_ad": expense.date_ad,
                "description": expense.description,
                "category": expense.category,
                "payment_method": expense.payment_method,
                "amount": amount,
                "cash_in": 0.0,
                "cash_out": amount,
                "order_id": None,
                "order_number": None,
                "customer_name": "",
            })

        entries.sort(key=lambda e: (e["date_ad"], e["type"], e["id"]))
        running = 0.0
        for entry in entries:
            running = round(running + entry["cash_in"] - entry["cash_out"], 2)
            entry["running_balance"] = running

        cash_in = round(sum(e["cash_in"] for e in entries), 2)
        cash_out = round(sum(e["cash_out"] for e in entries), 2)
        return {
            "cash_in": cash_in,
            "cash_out": cash_out,
            "net_cash": round(cash_in - cash_out, 2),
            "entries": entries,
        }

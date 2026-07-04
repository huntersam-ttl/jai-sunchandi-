"""
backend/repositories/payments_repo.py
CRUD for the payments table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import PaymentRow

TABLE = "payments"


class PaymentsRepo:

    @staticmethod
    def list_by_order(order_id: str) -> List[PaymentRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("order_id", order_id)
            .order("created_at", desc=False)
            .execute()
        )
        return [PaymentRow(**r) for r in res.data]

    @staticmethod
    def list_by_customer(customer_id: str) -> List[PaymentRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("customer_id", customer_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [PaymentRow(**r) for r in res.data]

    @staticmethod
    def get(payment_id: str) -> Optional[PaymentRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", payment_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return PaymentRow(**res.data[0])

    @staticmethod
    def create(fields: Dict[str, Any]) -> PaymentRow:
        res = supabase.table(TABLE).insert(fields).execute()
        return PaymentRow(**res.data[0])

    @staticmethod
    def delete(payment_id: str) -> bool:
        """Hard delete — payments are immutable once issued; use only for corrections."""
        res = (
            supabase.table(TABLE)
            .delete()
            .eq("id", payment_id)
            .execute()
        )
        return len(res.data) > 0

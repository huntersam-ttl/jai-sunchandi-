"""
backend/repositories/orders_repo.py
CRUD for the orders table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import OrderRow

TABLE = "orders"
COUNTER_NAME = "order"


def _next_order_number() -> str:
    res = (
        supabase.rpc(
            "increment_counter",
            {"counter_name": COUNTER_NAME},
        ).execute()
    )
    seq: int = res.data
    return f"ORD-{seq:04d}"


class OrdersRepo:

    @staticmethod
    def list_active(status: Optional[str] = None) -> List[OrderRow]:
        q = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
        )
        if status:
            q = q.eq("status", status)
        res = q.order("created_at", desc=True).execute()
        return [OrderRow(**r) for r in res.data]

    @staticmethod
    def get(order_id: str) -> Optional[OrderRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", order_id)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return OrderRow(**res.data[0])

    @staticmethod
    def get_by_number(order_number: str) -> Optional[OrderRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("order_number", order_number)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return OrderRow(**res.data[0])

    @staticmethod
    def lookup_public(order_number: str, phone: str) -> Optional[OrderRow]:
        """Public status lookup — matches order_number AND last-4 of phone."""
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("order_number", order_number)
            .ilike("customer_phone", f"%{phone[-4:]}")
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return OrderRow(**res.data[0])

    @staticmethod
    def list_by_customer(customer_id: str) -> List[OrderRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("customer_id", customer_id)
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return [OrderRow(**r) for r in res.data]

    @staticmethod
    def create(fields: Dict[str, Any]) -> OrderRow:
        fields = dict(fields)
        if "order_number" not in fields or not fields["order_number"]:
            fields["order_number"] = _next_order_number()
        res = supabase.table(TABLE).insert(fields).execute()
        return OrderRow(**res.data[0])

    @staticmethod
    def update(order_id: str, fields: Dict[str, Any]) -> Optional[OrderRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id", "order_number")}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", order_id)
            .eq("is_deleted", False)
            .execute()
        )
        if not res.data:
            return None
        return OrderRow(**res.data[0])

    @staticmethod
    def soft_delete(order_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", order_id)
            .execute()
        )
        return len(res.data) > 0

"""
backend/repositories/customers_repo.py
CRUD for the customers table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import CustomerRow

TABLE = "customers"


class CustomersRepo:

    @staticmethod
    def list_active() -> List[CustomerRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return [CustomerRow(**r) for r in res.data]

    @staticmethod
    def get(customer_id: str) -> Optional[CustomerRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", customer_id)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return CustomerRow(**res.data[0])

    @staticmethod
    def search_by_phone(phone: str) -> List[CustomerRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .ilike("phone", f"%{phone}%")
            .eq("is_deleted", False)
            .limit(20)
            .execute()
        )
        return [CustomerRow(**r) for r in res.data]

    @staticmethod
    def create(fields: Dict[str, Any]) -> CustomerRow:
        res = supabase.table(TABLE).insert(fields).execute()
        return CustomerRow(**res.data[0])

    @staticmethod
    def update(customer_id: str, fields: Dict[str, Any]) -> Optional[CustomerRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k != "id"}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", customer_id)
            .eq("is_deleted", False)
            .execute()
        )
        if not res.data:
            return None
        return CustomerRow(**res.data[0])

    @staticmethod
    def soft_delete(customer_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", customer_id)
            .execute()
        )
        return len(res.data) > 0

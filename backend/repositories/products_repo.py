"""
backend/repositories/products_repo.py
CRUD for the products table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import ProductRow

TABLE = "products"
COUNTER_NAME = "product"


def _next_product_code() -> str:
    """Atomically increment the products counter and return 'JSD-P-XXXX'."""
    res = (
        supabase.rpc(
            "increment_counter",
            {"counter_name": COUNTER_NAME},
        ).execute()
    )
    seq: int = res.data
    return f"JSD-P-{seq:04d}"


class ProductsRepo:

    @staticmethod
    def list_active(include_website_only: bool = False) -> List[ProductRow]:
        q = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
        )
        if include_website_only:
            q = q.eq("show_on_website", True)
        res = q.order("created_at", desc=True).execute()
        return [ProductRow(**r) for r in res.data]

    @staticmethod
    def get(product_id: str) -> Optional[ProductRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", product_id)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return ProductRow(**res.data[0])

    @staticmethod
    def get_by_code(product_code: str) -> Optional[ProductRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("product_code", product_code)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return ProductRow(**res.data[0])

    @staticmethod
    def create(fields: Dict[str, Any]) -> ProductRow:
        fields = dict(fields)
        if "product_code" not in fields or not fields["product_code"]:
            fields["product_code"] = _next_product_code()
        res = supabase.table(TABLE).insert(fields).execute()
        return ProductRow(**res.data[0])

    @staticmethod
    def update(product_id: str, fields: Dict[str, Any]) -> Optional[ProductRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id", "product_code")}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", product_id)
            .eq("is_deleted", False)
            .execute()
        )
        if not res.data:
            return None
        return ProductRow(**res.data[0])

    @staticmethod
    def soft_delete(product_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", product_id)
            .execute()
        )
        return len(res.data) > 0

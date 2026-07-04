"""
backend/repositories/invoices_repo.py
CRUD for the invoices table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import InvoiceRow

TABLE = "invoices"


class InvoicesRepo:

    @staticmethod
    def list_active() -> List[InvoiceRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
            .neq("status", "cancelled")
            .order("created_at", desc=True)
            .execute()
        )
        return [InvoiceRow(**r) for r in res.data]

    @staticmethod
    def get(invoice_id: str) -> Optional[InvoiceRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", invoice_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return InvoiceRow(**res.data[0])

    @staticmethod
    def get_by_bill_number(bill_number: str) -> Optional[InvoiceRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("bill_number", bill_number)
            .neq("status", "cancelled")
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return InvoiceRow(**res.data[0])

    @staticmethod
    def get_by_order(order_id: str) -> Optional[InvoiceRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("order_id", order_id)
            .neq("status", "cancelled")
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return InvoiceRow(**res.data[0])

    @staticmethod
    def create(fields: Dict[str, Any]) -> InvoiceRow:
        res = supabase.table(TABLE).insert(fields).execute()
        return InvoiceRow(**res.data[0])

    @staticmethod
    def update(invoice_id: str, fields: Dict[str, Any]) -> Optional[InvoiceRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id", "bill_number")}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", invoice_id)
            .execute()
        )
        if not res.data:
            return None
        return InvoiceRow(**res.data[0])

    @staticmethod
    def cancel(invoice_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", invoice_id)
            .execute()
        )
        return len(res.data) > 0

    @staticmethod
    def soft_delete(invoice_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", invoice_id)
            .execute()
        )
        return len(res.data) > 0

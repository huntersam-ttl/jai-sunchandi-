"""
backend/repositories/repairs_repo.py
CRUD for the repair_jobs table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import RepairJobRow

TABLE = "repair_jobs"
COUNTER_NAME = "repair"


def _next_repair_number() -> str:
    res = (
        supabase.rpc(
            "increment_counter",
            {"counter_name": COUNTER_NAME},
        ).execute()
    )
    seq: int = res.data
    return f"REP-{seq:04d}"


class RepairsRepo:

    @staticmethod
    def list_active(status: Optional[str] = None) -> List[RepairJobRow]:
        q = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
        )
        if status:
            q = q.eq("status", status)
        res = q.order("created_at", desc=True).execute()
        return [RepairJobRow(**r) for r in res.data]

    @staticmethod
    def get(repair_id: str) -> Optional[RepairJobRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", repair_id)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return RepairJobRow(**res.data[0])

    @staticmethod
    def list_by_customer(customer_id: str) -> List[RepairJobRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("customer_id", customer_id)
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return [RepairJobRow(**r) for r in res.data]

    @staticmethod
    def create(fields: Dict[str, Any]) -> RepairJobRow:
        fields = dict(fields)
        if "repair_number" not in fields or not fields["repair_number"]:
            fields["repair_number"] = _next_repair_number()
        res = supabase.table(TABLE).insert(fields).execute()
        return RepairJobRow(**res.data[0])

    @staticmethod
    def update(repair_id: str, fields: Dict[str, Any]) -> Optional[RepairJobRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id", "repair_number")}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", repair_id)
            .eq("is_deleted", False)
            .execute()
        )
        if not res.data:
            return None
        return RepairJobRow(**res.data[0])

    @staticmethod
    def soft_delete(repair_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", repair_id)
            .execute()
        )
        return len(res.data) > 0

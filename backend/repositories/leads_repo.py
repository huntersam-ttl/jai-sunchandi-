"""
backend/repositories/leads_repo.py
CRUD for the public_leads table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional

from db import supabase
from models import LeadRow

TABLE = "public_leads"


class LeadsRepo:

    @staticmethod
    def list_all(status: Optional[str] = None) -> List[LeadRow]:
        q = supabase.table(TABLE).select("*")
        if status:
            q = q.eq("status", status)
        res = q.order("created_at", desc=True).execute()
        return [LeadRow(**r) for r in res.data]

    @staticmethod
    def get(lead_id: str) -> Optional[LeadRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", lead_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return LeadRow(**res.data[0])

    @staticmethod
    def create(fields: Dict[str, Any]) -> LeadRow:
        res = supabase.table(TABLE).insert(fields).execute()
        return LeadRow(**res.data[0])

    @staticmethod
    def update_status(lead_id: str, status: str, notes: str = "") -> Optional[LeadRow]:
        from datetime import datetime, timezone

        payload: Dict[str, Any] = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if notes:
            payload["notes"] = notes

        res = (
            supabase.table(TABLE)
            .update(payload)
            .eq("id", lead_id)
            .execute()
        )
        if not res.data:
            return None
        return LeadRow(**res.data[0])

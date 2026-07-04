"""
backend/repositories/certificates_repo.py
CRUD for the certificates table.

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Dict, Any, List, Optional
from datetime import date

from db import supabase
from models import CertificateRow

TABLE = "certificates"
COUNTER_NAME = "certificate"


def _next_cert_number() -> str:
    res = (
        supabase.rpc(
            "increment_counter",
            {"counter_name": COUNTER_NAME},
        ).execute()
    )
    seq: int = res.data
    year = date.today().year
    return f"CERT-{year}-{seq:04d}"


class CertificatesRepo:

    @staticmethod
    def list_active() -> List[CertificateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return [CertificateRow(**r) for r in res.data]

    @staticmethod
    def get(cert_id: str) -> Optional[CertificateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", cert_id)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return CertificateRow(**res.data[0])

    @staticmethod
    def get_by_number(cert_number: str) -> Optional[CertificateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("certificate_number", cert_number)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return CertificateRow(**res.data[0])

    @staticmethod
    def list_by_product(product_id: str) -> List[CertificateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("product_id", product_id)
            .eq("is_deleted", False)
            .order("created_at", desc=True)
            .execute()
        )
        return [CertificateRow(**r) for r in res.data]

    @staticmethod
    def create(fields: Dict[str, Any]) -> CertificateRow:
        fields = dict(fields)
        if "certificate_number" not in fields or not fields["certificate_number"]:
            fields["certificate_number"] = _next_cert_number()
        res = supabase.table(TABLE).insert(fields).execute()
        return CertificateRow(**res.data[0])

    @staticmethod
    def update(cert_id: str, fields: Dict[str, Any]) -> Optional[CertificateRow]:
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id", "certificate_number")}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", cert_id)
            .eq("is_deleted", False)
            .execute()
        )
        if not res.data:
            return None
        return CertificateRow(**res.data[0])

    @staticmethod
    def soft_delete(cert_id: str) -> bool:
        from datetime import datetime, timezone

        res = (
            supabase.table(TABLE)
            .update({"is_deleted": True, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", cert_id)
            .execute()
        )
        return len(res.data) > 0

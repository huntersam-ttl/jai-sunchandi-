"""
backend/repositories/settings_repo.py
CRUD operations for the shop_settings table (singleton row, id = 'shop').

Python 3.9 compatible.
"""
from __future__ import annotations

from typing import Any, Dict

from db import supabase
from models import ShopSettingsRow

TABLE = "shop_settings"


class SettingsRepo:
    """Read and update the singleton shop settings row."""

    @staticmethod
    def get() -> ShopSettingsRow:
        """Return the current shop settings.  Raises if the row is missing."""
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("id", "shop")
            .single()
            .execute()
        )
        return ShopSettingsRow(**res.data)

    @staticmethod
    def update(fields: Dict[str, Any]) -> ShopSettingsRow:
        """
        Partial-update shop settings.

        *fields* is a dict of column→value pairs to change.
        Always stamps `updated_at` with the DB's now().
        """
        from datetime import datetime, timezone

        fields = {k: v for k, v in fields.items() if k not in ("id",)}
        fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .update(fields)
            .eq("id", "shop")
            .execute()
        )
        return ShopSettingsRow(**res.data[0])

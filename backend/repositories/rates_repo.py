"""
backend/repositories/rates_repo.py
CRUD for the daily_rates table.

Python 3.9 compatible.
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from db import supabase
from models import DailyRateRow

TABLE = "daily_rates"


class RatesRepo:

    @staticmethod
    def get_latest() -> Optional[DailyRateRow]:
        """Return today's rate if set, else the most recent row."""
        res = (
            supabase.table(TABLE)
            .select("*")
            .order("date_ad", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return DailyRateRow(**res.data[0])

    @staticmethod
    def get_by_date(date_ad: date) -> Optional[DailyRateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .eq("date_ad", date_ad.isoformat())
            .limit(1)
            .execute()
        )
        if not res.data:
            return None
        return DailyRateRow(**res.data[0])

    @staticmethod
    def list_recent(limit: int = 30) -> List[DailyRateRow]:
        res = (
            supabase.table(TABLE)
            .select("*")
            .order("date_ad", desc=True)
            .limit(limit)
            .execute()
        )
        return [DailyRateRow(**r) for r in res.data]

    @staticmethod
    def upsert(row: dict) -> DailyRateRow:
        """
        Insert or update a rate for a given date_ad.
        *row* must include: date_ad, gold_24k, gold_22k, silver.
        Optional: bs_date, bs_date_np.
        """
        from datetime import datetime, timezone

        row = dict(row)
        if isinstance(row.get("date_ad"), date):
            row["date_ad"] = row["date_ad"].isoformat()
        row["updated_at"] = datetime.now(timezone.utc).isoformat()

        res = (
            supabase.table(TABLE)
            .upsert(row, on_conflict="date_ad")
            .execute()
        )
        return DailyRateRow(**res.data[0])

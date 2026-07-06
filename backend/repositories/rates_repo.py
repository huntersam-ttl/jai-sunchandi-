"""Daily gold/silver rates repository. Reuses the BS-date helper from utils."""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from models import DailyRate
from utils import ad_to_bs
from .base import BaseRepository


class RatesRepository(BaseRepository):
    model = DailyRate

    async def upsert(self, date_ad: str, gold_24k, gold_22k, silver) -> DailyRate:
        """Insert or update a day's rate; BS dates are derived (utils.ad_to_bs)."""
        bs = ad_to_bs(date_ad)
        values = dict(
            date_ad=date_ad, gold_24k=gold_24k, gold_22k=gold_22k, silver=silver,
            bs_date=bs["bs_date"], bs_date_np=bs["bs_date_np"],
            bs_date_long_np=bs["bs_date_long_np"],
        )
        stmt = pg_insert(DailyRate).values(**values)
        stmt = stmt.on_conflict_do_update(
            index_elements=[DailyRate.date_ad],
            set_={k: values[k] for k in
                  ("gold_24k", "gold_22k", "silver", "bs_date", "bs_date_np", "bs_date_long_np")},
        ).returning(DailyRate)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def latest(self) -> DailyRate | None:
        stmt = select(DailyRate).order_by(DailyRate.date_ad.desc()).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def history(self, days: int = 30):
        cutoff = date.today() - timedelta(days=days)  # a date, not a string (date_ad is DATE)
        stmt = (select(DailyRate)
                .where(DailyRate.date_ad >= cutoff)
                .order_by(DailyRate.date_ad.asc()))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

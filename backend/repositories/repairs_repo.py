"""Repair jobs repository. BS promised-date derived via utils.ad_to_bs."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select

from models import RepairJob
from utils import ad_to_bs
from .base import BaseRepository

_FINISHED_STATUSES = ("delivered", "cancelled")


class RepairsRepository(BaseRepository):
    model = RepairJob

    @staticmethod
    def _date_or_none(value) -> date | None:
        if value in (None, ""):
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date() if "T" in value else date.fromisoformat(value)
        raise ValueError("Invalid promised date")

    async def list(self, *, status=None):
        stmt = select(RepairJob).where(RepairJob.is_deleted.is_(False))
        if status:
            stmt = stmt.where(RepairJob.status == status)
        stmt = stmt.order_by(RepairJob.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_pending(self, *, limit: int | None = None) -> list[RepairJob]:
        """Not-yet-finished repair jobs, filtered and capped at the DB level
        (the dashboard previously fetched every repair row and filtered/sliced
        in Python)."""
        stmt = (select(RepairJob)
                .where(RepairJob.is_deleted.is_(False), RepairJob.status.notin_(_FINISHED_STATUSES))
                .order_by(RepairJob.created_at.desc()))
        if limit:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_pending(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(RepairJob)
            .where(RepairJob.is_deleted.is_(False), RepairJob.status.notin_(_FINISHED_STATUSES)))
        return result.scalar_one()

    async def create_repair(self, *, customer, service_type="repair", description="",
                            promised_date_ad=None, charge=0, status="received",
                            intake_photo_url="", damage_photo_url="", after_photo_url="") -> RepairJob:
        promised_date_ad = self._date_or_none(promised_date_ad)
        bs = ad_to_bs(promised_date_ad) if promised_date_ad else {}
        repair = RepairJob(
            customer_id=customer.id, customer_name=customer.name, customer_phone=customer.phone,
            service_type=service_type, description=description,
            intake_photo_url=intake_photo_url, damage_photo_url=damage_photo_url,
            after_photo_url=after_photo_url, promised_date_ad=promised_date_ad,
            promised_date_bs=bs.get("bs_date"), promised_date_bs_np=bs.get("bs_date_np"),
            charge=charge, paid_amount=0, status=status,
        )
        self.session.add(repair)
        await self.session.flush()
        return repair

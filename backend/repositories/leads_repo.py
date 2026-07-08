"""Public leads (website enquiries) repository."""
from __future__ import annotations

from sqlalchemy import func, select

from models import Lead
from .base import BaseRepository


class LeadsRepository(BaseRepository):
    model = Lead

    async def count_new(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Lead).where(Lead.status == "new"))
        return result.scalar_one()

    async def list(self, *, status=None, limit: int | None = 50, offset: int = 0):
        stmt = select(Lead)
        if status:
            stmt = stmt.where(Lead.status == status)
        stmt = stmt.order_by(Lead.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, *, status=None) -> int:
        stmt = select(func.count()).select_from(Lead)
        if status:
            stmt = stmt.where(Lead.status == status)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def create_lead(self, **fields) -> Lead:
        fields.setdefault("status", "new")
        lead = Lead(**fields)
        self.session.add(lead)
        await self.session.flush()
        return lead

    async def set_status(self, lead_id, status: str) -> Lead | None:
        lead = await self.get(lead_id)
        if lead is not None:
            lead.status = status
            await self.session.flush()
        return lead

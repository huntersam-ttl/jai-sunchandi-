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

    async def list(self, *, status=None):
        stmt = select(Lead)
        if status:
            stmt = stmt.where(Lead.status == status)
        stmt = stmt.order_by(Lead.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

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

"""Public leads (website enquiries) repository."""
from __future__ import annotations

from sqlalchemy import func, select

from models import Lead
from .base import BaseRepository, archived_clause


class LeadsRepository(BaseRepository):
    model = Lead

    async def count_new(self) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Lead)
            .where(Lead.status == "new", Lead.is_deleted.is_(False)))
        return result.scalar_one()

    async def list(self, *, status=None, archived: str = "active",
                   limit: int | None = 50, offset: int = 0):
        stmt = select(Lead)
        clause = archived_clause(Lead.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        if status:
            stmt = stmt.where(Lead.status == status)
        stmt = stmt.order_by(Lead.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count(self, *, status=None, archived: str = "active") -> int:
        stmt = select(func.count()).select_from(Lead)
        clause = archived_clause(Lead.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        if status:
            stmt = stmt.where(Lead.status == status)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def archive(self, lead_id) -> Lead | None:
        lead = await self.get(lead_id)
        if lead is not None:
            lead.is_deleted = True
            await self.session.flush()
        return lead

    async def restore(self, lead_id) -> Lead | None:
        lead = await self.get(lead_id)
        if lead is not None:
            lead.is_deleted = False
            await self.session.flush()
        return lead

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

"""Admin tasks/reminders and per-order material tracking repositories."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select

from models import AdminTask, MaterialTask
from .base import BaseRepository


class AdminTasksRepository(BaseRepository):
    model = AdminTask

    async def list(self, *, status=None):
        stmt = select(AdminTask)
        if status:
            stmt = stmt.where(AdminTask.status == status)
        stmt = stmt.order_by(AdminTask.due_date_ad.asc().nulls_last(),
                             AdminTask.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class MaterialTasksRepository(BaseRepository):
    model = MaterialTask

    async def list_for_order(self, order_id):
        stmt = (select(MaterialTask).where(MaterialTask.order_id == order_id)
                .order_by(MaterialTask.created_at.asc()))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_status(self, status: str):
        stmt = (select(MaterialTask).where(MaterialTask.material_status == status)
                .order_by(MaterialTask.created_at.desc()))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def mark_purchased(self, task_id) -> MaterialTask | None:
        task = await self.get(task_id)
        if task is not None:
            task.material_status = "purchased"
            task.purchased_at = datetime.now(timezone.utc)
            await self.session.flush()
        return task

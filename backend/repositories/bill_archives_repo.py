"""Bill archive repository -- photo scans of hand-written physical bills.

Search matches the bill's own fields (bill_number/customer_name/
customer_phone) plus, via outer join, the order_number/repair_number of
whatever it's linked to -- so "search by order number if linked" works
without the caller needing to know the link exists.
"""
from __future__ import annotations

from sqlalchemy import func, or_, select

from models import BillArchive, Order, RepairJob
from .base import BaseRepository, archived_clause


def _search_filter(q: str):
    like = f"%{q}%"
    return or_(
        BillArchive.bill_number.ilike(like),
        BillArchive.customer_name.ilike(like),
        BillArchive.customer_phone.ilike(like),
        Order.order_number.ilike(like),
        RepairJob.repair_number.ilike(like),
    )


class BillArchivesRepository(BaseRepository):
    model = BillArchive

    def _base_query(self, archived: str = "active"):
        stmt = (
            select(BillArchive)
            .outerjoin(Order, BillArchive.related_order_id == Order.id)
            .outerjoin(RepairJob, BillArchive.related_repair_id == RepairJob.id)
        )
        clause = archived_clause(BillArchive.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        return stmt

    async def list(self, *, q=None, payment_status=None, start_date=None, end_date=None,
                   archived: str = "active", limit: int | None = 50, offset: int = 0):
        stmt = self._base_query(archived)
        if q:
            stmt = stmt.where(_search_filter(q))
        if payment_status:
            stmt = stmt.where(BillArchive.payment_status == payment_status)
        if start_date:
            stmt = stmt.where(BillArchive.bill_date >= start_date)
        if end_date:
            stmt = stmt.where(BillArchive.bill_date <= end_date)
        stmt = stmt.order_by(BillArchive.bill_date.desc().nullslast(), BillArchive.created_at.desc())
        if limit:
            stmt = stmt.limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count(self, *, q=None, payment_status=None, start_date=None, end_date=None,
                    archived: str = "active") -> int:
        stmt = (
            select(func.count(func.distinct(BillArchive.id)))
            .select_from(BillArchive)
            .outerjoin(Order, BillArchive.related_order_id == Order.id)
            .outerjoin(RepairJob, BillArchive.related_repair_id == RepairJob.id)
        )
        clause = archived_clause(BillArchive.is_deleted, archived)
        if clause is not None:
            stmt = stmt.where(clause)
        if q:
            stmt = stmt.where(_search_filter(q))
        if payment_status:
            stmt = stmt.where(BillArchive.payment_status == payment_status)
        if start_date:
            stmt = stmt.where(BillArchive.bill_date >= start_date)
        if end_date:
            stmt = stmt.where(BillArchive.bill_date <= end_date)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    def create(self, **fields):
        bill = BillArchive(**fields)
        self.session.add(bill)
        return bill

    async def update(self, bill_id, **fields):
        bill = await self.get(bill_id)
        if bill is None:
            return None
        for key, value in fields.items():
            if hasattr(bill, key):
                setattr(bill, key, value)
        await self.session.flush()
        return bill

    async def archive(self, bill_id) -> BillArchive | None:
        bill = await self.get(bill_id)
        if bill is not None:
            bill.is_deleted = True
            await self.session.flush()
        return bill

    async def restore(self, bill_id) -> BillArchive | None:
        bill = await self.get(bill_id)
        if bill is not None:
            bill.is_deleted = False
            await self.session.flush()
        return bill

    async def hard_delete(self, bill_id) -> bool:
        """Permanently remove a bill row. Callers must only reach this after
        the bill is already archived and an explicit typed confirmation --
        this repo method itself doesn't re-check that, the route does."""
        bill = await self.get(bill_id)
        if bill is None:
            return False
        await self.session.delete(bill)
        await self.session.flush()
        return True

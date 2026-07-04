"""Base repository: shared async CRUD helpers over a SQLAlchemy AsyncSession.

Repositories are thin data-access objects. They do not open transactions
themselves — the caller (a route/service in a later phase) owns the session and
commit boundary (see db.session_scope / db.get_session).
"""
from typing import Any, Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


class BaseRepository:
    model: Any = None

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get(self, id_: Any) -> Optional[Any]:
        return await self.session.get(self.model, id_)

    async def list(self, order_by: Any = None) -> Sequence[Any]:
        stmt = select(self.model)
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def add(self, obj: Any) -> Any:
        self.session.add(obj)
        await self.session.flush()
        return obj

    def create(self, **fields: Any) -> Any:
        obj = self.model(**fields)
        self.session.add(obj)
        return obj


def derive_payment_status(net_payable, advance_total) -> str:
    """unpaid / partial / paid, from an order's net payable and advance total."""
    net = float(net_payable or 0)
    advance = float(advance_total or 0)
    if advance <= 0:
        return "unpaid"
    if advance >= net:
        return "paid"
    return "partial"

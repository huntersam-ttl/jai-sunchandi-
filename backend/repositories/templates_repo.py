"""WhatsApp message templates repository (manual wa.me notifications).

Sending is never automated and no paid API is used; the admin UI (later phase)
renders a filled message and opens a wa.me link. This repo stores/serves the
editable templates and offers a safe placeholder-fill helper.
"""
from __future__ import annotations

from sqlalchemy import select

from models import WhatsappTemplate
from .base import BaseRepository


class TemplatesRepository(BaseRepository):
    model = WhatsappTemplate

    async def list_active(self):
        stmt = (select(WhatsappTemplate).where(WhatsappTemplate.is_active.is_(True))
                .order_by(WhatsappTemplate.sort_order, WhatsappTemplate.name))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_slug(self, slug: str) -> WhatsappTemplate | None:
        stmt = select(WhatsappTemplate).where(WhatsappTemplate.slug == slug)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    def render(body: str, values: dict) -> str:
        """Fill {placeholders} in a template body, leaving unknown ones intact."""
        out = body
        for key, value in (values or {}).items():
            out = out.replace("{" + key + "}", str(value))
        return out

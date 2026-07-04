"""Shop settings (singleton) repository."""
from __future__ import annotations

from models import ShopSettings
from .base import BaseRepository

# Columns safe to expose to the public site (no internal/audit fields).
PUBLIC_FIELDS = (
    "shop_name", "shop_name_np", "tagline", "tagline_np", "phone", "whatsapp",
    "address", "maps_link", "opening_hours", "logo_url", "default_whatsapp_message",
)


class SettingsRepository(BaseRepository):
    model = ShopSettings

    async def get_settings(self) -> ShopSettings | None:
        # Singleton row keyed by id = true.
        return await self.session.get(ShopSettings, True)

    async def update_settings(self, **fields) -> ShopSettings | None:
        row = await self.get_settings()
        if row is None:
            return None
        for key, value in fields.items():
            if hasattr(row, key):
                setattr(row, key, value)
        await self.session.flush()
        return row

    async def public_settings(self) -> dict:
        row = await self.get_settings()
        if row is None:
            return {}
        return {field: getattr(row, field) for field in PUBLIC_FIELDS}

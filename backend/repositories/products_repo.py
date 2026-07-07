"""Products repository. Reuses compute_price/tola helpers from utils (no dup)."""
from __future__ import annotations

from sqlalchemy import String, cast, func, or_, select

from models import Product
from utils import compute_price, grams_to_tola
from .base import BaseRepository


class ProductsRepository(BaseRepository):
    model = Product

    async def list(self, *, status=None, metal=None, include_deleted=False):
        stmt = select(Product)
        if not include_deleted:
            stmt = stmt.where(Product.is_deleted.is_(False))
        if status:
            stmt = stmt.where(Product.status == status)
        if metal:
            stmt = stmt.where(Product.metal == metal)
        stmt = stmt.order_by(Product.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_status(self, status: str) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(Product)
            .where(Product.is_deleted.is_(False), Product.status == status))
        return result.scalar_one()

    async def list_public(self, *, metal=None, category=None, collection=None):
        stmt = select(Product).where(
            Product.is_deleted.is_(False),
            Product.show_on_website.is_(True),
            Product.status.notin_(["sold", "inactive"]),
        )
        if metal:
            stmt = stmt.where(Product.metal == metal)
        if category:
            stmt = stmt.where(Product.category == category)
        if collection:
            stmt = stmt.where(Product.collection == collection)
        stmt = stmt.order_by(Product.created_at.desc())
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_public_detail(self, id_or_code):
        """Public product by UUID id or product_code; website-visible only."""
        stmt = select(Product).where(
            Product.is_deleted.is_(False),
            Product.show_on_website.is_(True),
            or_(cast(Product.id, String) == id_or_code, Product.product_code == id_or_code),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def soft_delete(self, product_id) -> None:
        product = await self.get(product_id)
        if product is not None:
            product.is_deleted = True
            product.status = "inactive"
            await self.session.flush()

    @staticmethod
    def live_price(product: Product, rate: dict | None) -> dict | None:
        """Compute today's price for a product using the shared pricing engine."""
        if not rate:
            return None
        rpt = rate["gold_24k"] if product.metal == "gold" else rate["silver"]
        return compute_price(
            float(product.weight_grams), float(rpt), product.purity,
            float(product.jarti_percent), float(product.jyala_amount), product.jyala_type,
            float(product.stone_cost), float(product.polishing_cost),
            float(product.cutting_cost), float(product.worker_charge),
            float(product.other_cost),
        )

    @staticmethod
    def weight_tola(product: Product) -> float:
        return grams_to_tola(float(product.weight_grams))

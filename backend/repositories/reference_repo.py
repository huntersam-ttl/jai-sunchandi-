"""Categories and collections (catalogue taxonomy) repositories."""
from sqlalchemy import select

from models import Category, Collection
from .base import BaseRepository


class CategoriesRepository(BaseRepository):
    model = Category

    async def list_active(self):
        stmt = select(Category).where(Category.is_active.is_(True)).order_by(
            Category.sort_order, Category.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class CollectionsRepository(BaseRepository):
    model = Collection

    async def list_active(self):
        stmt = select(Collection).where(Collection.is_active.is_(True)).order_by(
            Collection.sort_order, Collection.name)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

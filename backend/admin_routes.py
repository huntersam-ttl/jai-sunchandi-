"""Authenticated admin routes (S5C1: rates + reference data only).

Every route requires a valid Supabase admin JWT (get_current_admin, enforced at
the router level). Reads/writes go through the existing SQLAlchemy repos. Only
rates, categories, and collections are wired here; other admin domains follow in
later S5C slices.
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import db
from repositories import CategoriesRepository, CollectionsRepository, RatesRepository
from supabase_auth import get_current_admin

router = APIRouter(prefix="/api/admin", dependencies=[Depends(get_current_admin)])


# ---------- Models ----------
class RateBody(BaseModel):
    date_ad: Optional[str] = None  # defaults to today
    gold_24k: float
    gold_22k: float
    silver: float


class ReferenceBody(BaseModel):
    name: str
    is_active: bool = True
    sort_order: int = 0


class ReferenceUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


# ---------- Shapers ----------
def _iso(d):
    return d.isoformat() if hasattr(d, "isoformat") else d


def _rate(r) -> dict:
    return {
        "id": str(r.id), "date_ad": _iso(r.date_ad), "bs_date": r.bs_date,
        "bs_date_np": r.bs_date_np, "bs_date_long_np": r.bs_date_long_np,
        "gold_24k": float(r.gold_24k), "gold_22k": float(r.gold_22k),
        "silver": float(r.silver),
    }


def _ref(r) -> dict:
    return {"id": str(r.id), "name": r.name, "is_active": r.is_active, "sort_order": r.sort_order}


# ---------- Rates ----------
@router.post("/rates")
async def create_rate(body: RateBody, session: AsyncSession = Depends(db.get_session)):
    date_ad = body.date_ad or date.today().isoformat()
    rate = await RatesRepository(session).upsert(date_ad, body.gold_24k, body.gold_22k, body.silver)
    await session.commit()
    return _rate(rate)


# ---------- Shared reference-data CRUD (categories + collections) ----------
async def _ref_list(repo_cls, session):
    repo = repo_cls(session)
    rows = await repo.list(order_by=repo_cls.model.sort_order)
    return [_ref(r) for r in rows]


async def _ref_create(repo_cls, body: ReferenceBody, session):
    repo = repo_cls(session)
    obj = repo.create(name=body.name, is_active=body.is_active, sort_order=body.sort_order)
    try:
        await session.flush()
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail=f"'{body.name}' already exists")
    return _ref(obj)


async def _ref_update(repo_cls, ref_id, body: ReferenceUpdate, session):
    repo = repo_cls(session)
    obj = await repo.get(ref_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(obj, key, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Name already exists")
    return _ref(obj)


async def _ref_delete(repo_cls, ref_id, session):
    repo = repo_cls(session)
    obj = await repo.get(ref_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    await session.delete(obj)
    await session.commit()
    return {"ok": True}


# ---------- Categories ----------
@router.get("/categories")
async def list_categories(session: AsyncSession = Depends(db.get_session)):
    return await _ref_list(CategoriesRepository, session)


@router.post("/categories")
async def create_category(body: ReferenceBody, session: AsyncSession = Depends(db.get_session)):
    return await _ref_create(CategoriesRepository, body, session)


@router.put("/categories/{cid}")
async def update_category(cid: str, body: ReferenceUpdate, session: AsyncSession = Depends(db.get_session)):
    return await _ref_update(CategoriesRepository, cid, body, session)


@router.delete("/categories/{cid}")
async def delete_category(cid: str, session: AsyncSession = Depends(db.get_session)):
    return await _ref_delete(CategoriesRepository, cid, session)


# ---------- Collections ----------
@router.get("/collections")
async def list_collections(session: AsyncSession = Depends(db.get_session)):
    return await _ref_list(CollectionsRepository, session)


@router.post("/collections")
async def create_collection(body: ReferenceBody, session: AsyncSession = Depends(db.get_session)):
    return await _ref_create(CollectionsRepository, body, session)


@router.put("/collections/{cid}")
async def update_collection(cid: str, body: ReferenceUpdate, session: AsyncSession = Depends(db.get_session)):
    return await _ref_update(CollectionsRepository, cid, body, session)


@router.delete("/collections/{cid}")
async def delete_collection(cid: str, session: AsyncSession = Depends(db.get_session)):
    return await _ref_delete(CollectionsRepository, cid, session)

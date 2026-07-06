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
from models import Product
from repositories import (
    CategoriesRepository, CollectionsRepository, ProductsRepository, RatesRepository,
)
from supabase_auth import get_current_admin
from utils import grams_to_tola, tola_lal_aana_to_grams

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


# ---------- Products ----------
class WeightInput(BaseModel):
    grams: Optional[float] = None
    tola: Optional[float] = None
    lal: Optional[float] = None
    aana: Optional[float] = None


class ProductBody(BaseModel):
    name: str
    name_np: str = ""
    description: str = ""
    category: str = ""
    collection: str = ""
    metal: str = "gold"
    purity: str = "24K"
    weight: WeightInput
    jarti_percent: float = 0
    jyala_amount: float = 0
    jyala_type: str = "flat"
    stone_cost: float = 0
    polishing_cost: float = 0
    cutting_cost: float = 0
    worker_charge: float = 0
    other_cost: float = 0
    status: str = "available"
    show_on_website: bool = True
    show_price_on_website: bool = True
    photos: list = []   # public product-photos URLs (never base64)


def _rate_dict(rate):
    return {"gold_24k": float(rate.gold_24k), "silver": float(rate.silver)} if rate else None


def _product(p, rate) -> dict:
    return {
        "id": str(p.id), "product_code": p.product_code, "name": p.name, "name_np": p.name_np,
        "description": p.description, "category": p.category, "collection": p.collection,
        "metal": p.metal, "purity": p.purity,
        "weight_grams": float(p.weight_grams), "weight_tola": grams_to_tola(float(p.weight_grams)),
        "jarti_percent": float(p.jarti_percent), "jyala_amount": float(p.jyala_amount),
        "jyala_type": p.jyala_type, "stone_cost": float(p.stone_cost),
        "polishing_cost": float(p.polishing_cost), "cutting_cost": float(p.cutting_cost),
        "worker_charge": float(p.worker_charge), "other_cost": float(p.other_cost),
        "status": p.status, "show_on_website": p.show_on_website,
        "show_price_on_website": p.show_price_on_website, "photos": p.photos or [],
        "is_deleted": p.is_deleted,
        "live_price": ProductsRepository.live_price(p, _rate_dict(rate)),
    }


def _grams(w: WeightInput) -> float:
    return w.grams if w.grams else tola_lal_aana_to_grams(w.tola or 0, w.lal or 0, w.aana or 0)


def _apply_product_fields(p, body: ProductBody, grams: float):
    p.name = body.name
    p.name_np = body.name_np
    p.description = body.description
    p.category = body.category
    p.collection = body.collection
    p.metal = body.metal
    p.purity = body.purity
    p.weight_grams = grams
    p.jarti_percent = body.jarti_percent
    p.jyala_amount = body.jyala_amount
    p.jyala_type = body.jyala_type
    p.stone_cost = body.stone_cost
    p.polishing_cost = body.polishing_cost
    p.cutting_cost = body.cutting_cost
    p.worker_charge = body.worker_charge
    p.other_cost = body.other_cost
    p.status = body.status
    p.show_on_website = body.show_on_website
    p.show_price_on_website = body.show_price_on_website
    p.photos = body.photos


@router.get("/products")
async def list_products(status: Optional[str] = None, metal: Optional[str] = None,
                        q: Optional[str] = None, session: AsyncSession = Depends(db.get_session)):
    rows = await ProductsRepository(session).list(status=status, metal=metal)
    if q:
        ql = q.lower()
        rows = [r for r in rows if ql in r.name.lower() or ql in (r.product_code or "").lower()]
    rate = await RatesRepository(session).latest()
    return [_product(p, rate) for p in rows]


@router.post("/products")
async def create_product(body: ProductBody, session: AsyncSession = Depends(db.get_session)):
    grams = _grams(body.weight)
    if grams <= 0:
        raise HTTPException(status_code=400, detail="Weight must be greater than 0")
    p = Product()
    _apply_product_fields(p, body, grams)
    session.add(p)
    await session.commit()
    await session.refresh(p)   # load DB-generated product_code + timestamps
    rate = await RatesRepository(session).latest()
    return _product(p, rate)


@router.get("/products/{pid}")
async def get_product(pid: str, session: AsyncSession = Depends(db.get_session)):
    p = await ProductsRepository(session).get(pid)
    if not p or p.is_deleted:
        raise HTTPException(status_code=404, detail="Product not found")
    rate = await RatesRepository(session).latest()
    return _product(p, rate)


@router.put("/products/{pid}")
async def update_product(pid: str, body: ProductBody, session: AsyncSession = Depends(db.get_session)):
    repo = ProductsRepository(session)
    p = await repo.get(pid)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    grams = _grams(body.weight)
    if grams <= 0:
        raise HTTPException(status_code=400, detail="Weight must be greater than 0")
    _apply_product_fields(p, body, grams)
    await session.commit()
    await session.refresh(p)
    rate = await RatesRepository(session).latest()
    return _product(p, rate)


@router.delete("/products/{pid}")
async def delete_product(pid: str, session: AsyncSession = Depends(db.get_session)):
    repo = ProductsRepository(session)
    p = await repo.get(pid)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    await repo.soft_delete(pid)
    await session.commit()
    return {"ok": True}

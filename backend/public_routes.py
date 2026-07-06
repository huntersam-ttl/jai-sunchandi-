"""Public (unauthenticated) read routes for the Supabase-backed website.

These mirror the response shapes of the legacy Mongo endpoints so the existing
public pages work unchanged. Reads go through the SQLAlchemy repositories; the
backend uses the service-role DB connection (RLS-exempt) and returns only
public-safe fields (no cost/profit columns, no private data).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import db
from repositories import (
    CategoriesRepository, CollectionsRepository, LeadsRepository, OrdersRepository,
    ProductsRepository, RatesRepository, SettingsRepository,
)
from utils import compute_price, grams_to_tola, to_nepali_digits

router = APIRouter(prefix="/api")


def _iso(d):
    return d.isoformat() if hasattr(d, "isoformat") else d


def _rate_public(rate) -> dict:
    return {
        "id": str(rate.id), "date_ad": _iso(rate.date_ad),
        "bs_date": rate.bs_date, "bs_date_np": rate.bs_date_np,
        "gold_24k": float(rate.gold_24k), "gold_22k": float(rate.gold_22k),
        "silver": float(rate.silver),
        "gold_24k_np": to_nepali_digits(f"{float(rate.gold_24k):,.0f}"),
        "gold_22k_np": to_nepali_digits(f"{float(rate.gold_22k):,.0f}"),
        "silver_np": to_nepali_digits(f"{float(rate.silver):,.0f}"),
    }


def _estimated_price(p, rate) -> Optional[float]:
    if not rate or not p.show_price_on_website:
        return None
    rpt = float(rate.gold_24k) if p.metal == "gold" else float(rate.silver)
    return compute_price(
        float(p.weight_grams), rpt, p.purity, float(p.jarti_percent),
        float(p.jyala_amount), p.jyala_type, float(p.stone_cost),
        float(p.polishing_cost), float(p.cutting_cost), float(p.worker_charge),
        float(p.other_cost),
    )["total_price"]


def _product_public(p, rate) -> dict:
    return {
        "id": str(p.id), "product_code": p.product_code, "name": p.name,
        "name_np": p.name_np, "description": p.description, "category": p.category,
        "collection": p.collection, "metal": p.metal, "purity": p.purity,
        "weight_grams": float(p.weight_grams), "weight_tola": grams_to_tola(float(p.weight_grams)),
        "status": p.status, "photos": p.photos or [],
        "estimated_price": _estimated_price(p, rate),
        "show_price_on_website": p.show_price_on_website,
    }


@router.get("/rates/today")
async def rates_today(session: AsyncSession = Depends(db.get_session)):
    rate = await RatesRepository(session).latest()
    return _rate_public(rate) if rate else None


@router.get("/rates/history")
async def rates_history(days: int = 30, session: AsyncSession = Depends(db.get_session)):
    rows = await RatesRepository(session).history(days)
    return [
        {"id": str(r.id), "date_ad": _iso(r.date_ad), "bs_date": r.bs_date,
         "bs_date_np": r.bs_date_np, "gold_24k": float(r.gold_24k),
         "gold_22k": float(r.gold_22k), "silver": float(r.silver)}
        for r in rows
    ]


@router.get("/categories")
async def categories(session: AsyncSession = Depends(db.get_session)):
    rows = await CategoriesRepository(session).list_active()
    return [{"id": str(r.id), "name": r.name, "sort_order": r.sort_order} for r in rows]


@router.get("/collections")
async def collections(session: AsyncSession = Depends(db.get_session)):
    rows = await CollectionsRepository(session).list_active()
    return [{"id": str(r.id), "name": r.name, "sort_order": r.sort_order} for r in rows]


@router.get("/products")
async def products(metal: Optional[str] = None, category: Optional[str] = None,
                   collection: Optional[str] = None, availability: Optional[str] = None,
                   session: AsyncSession = Depends(db.get_session)):
    repo = ProductsRepository(session)
    rows = await repo.list_public(metal=metal, category=category, collection=collection)
    if availability:
        rows = [r for r in rows if r.status == availability]
    rate = await RatesRepository(session).latest()
    return [_product_public(p, rate) for p in rows]


@router.get("/products/{id_or_code}")
async def product_detail(id_or_code: str, session: AsyncSession = Depends(db.get_session)):
    repo = ProductsRepository(session)
    p = await repo.get_public_detail(id_or_code)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    rate = await RatesRepository(session).latest()
    return _product_public(p, rate)


@router.get("/settings")
async def public_settings(session: AsyncSession = Depends(db.get_session)):
    data = await SettingsRepository(session).public_settings()
    # Frontend expects a `logo` key (URL); the DB column is `logo_url`.
    if "logo_url" in data:
        data["logo"] = data.pop("logo_url")
    return data


# ---------- Public writes ----------
class LeadCreate(BaseModel):
    lead_type: str = "custom_order"
    name: str
    phone: str
    item_type: str = ""
    metal: str = ""
    service_type: str = ""
    approx_weight: str = ""
    budget: str = ""
    deadline: str = ""
    notes: str = ""
    photo_url: str = ""   # stored Storage path (private) — never base64


@router.post("/leads")
async def create_lead(body: LeadCreate, session: AsyncSession = Depends(db.get_session)):
    """Public custom-order / repair enquiry (matches the legacy /leads contract)."""
    if body.lead_type not in ("custom_order", "repair"):
        raise HTTPException(status_code=422, detail="Invalid lead_type")
    if not body.name.strip() or not body.phone.strip():
        raise HTTPException(status_code=422, detail="Name and phone are required")
    lead = await LeadsRepository(session).create_lead(**body.model_dump())
    await session.commit()
    return {"ok": True, "id": str(lead.id)}


@router.get("/public/order-status")
async def public_order_status(order_number: str, phone: str,
                              session: AsyncSession = Depends(db.get_session)):
    """Order status by order number + phone (both required). Minimal fields only —
    no balance/payment/customer data."""
    order = await OrdersRepository(session).public_status(order_number.strip(), phone.strip())
    if not order:
        raise HTTPException(status_code=404, detail="No active order found for that order number and phone")
    return {
        "order_number": order.order_number,
        "order_type": order.order_type,
        "status": order.status,
        "delivery_date_ad": _iso(order.delivery_date_ad) if order.delivery_date_ad else None,
        "delivery_date_bs_np": order.delivery_date_bs_np,
    }

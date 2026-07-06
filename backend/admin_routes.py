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
    CategoriesRepository, CollectionsRepository, CustomersRepository, ProductsRepository,
    OrdersRepository, RatesRepository,
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


# ---------- Customers ----------
class CustomerBody(BaseModel):
    name: str
    phone: str
    address: str = ""
    notes: str = ""


def _customer(c) -> dict:
    return {
        "id": str(c.id), "name": c.name, "phone": c.phone, "address": c.address,
        "notes": c.notes, "is_deleted": c.is_deleted,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _profile(p: dict) -> dict:
    """Customer khata profile — read-only summary of related records."""
    return {
        **_customer(p["customer"]),
        "orders": [
            {"id": str(o.id), "order_number": o.order_number, "order_type": o.order_type,
             "order_date_ad": _iso(o.order_date_ad), "net_payable": float(o.net_payable),
             "remaining_balance": float(o.remaining_balance), "status": o.status}
            for o in p["orders"]
        ],
        "payments": [
            {"id": str(pm.id), "payment_date_ad": _iso(pm.payment_date_ad), "method": pm.method,
             "note": pm.note, "amount": float(pm.amount)}
            for pm in p["payments"]
        ],
        "repairs": [
            {"id": str(r.id), "repair_number": r.repair_number, "service_type": r.service_type,
             "charge": float(r.charge), "status": r.status}
            for r in p["repairs"]
        ],
        "total_outstanding": p["total_outstanding"],
    }


@router.get("/customers")
async def list_customers(q: Optional[str] = None, session: AsyncSession = Depends(db.get_session)):
    rows = await CustomersRepository(session).search(q)
    return [_customer(c) for c in rows]


@router.post("/customers")
async def create_customer(body: CustomerBody, session: AsyncSession = Depends(db.get_session)):
    repo = CustomersRepository(session)
    c = repo.create(name=body.name, phone=body.phone, address=body.address, notes=body.notes)
    await session.commit()
    await session.refresh(c)
    return _customer(c)


@router.get("/customers/{cid}")
async def customer_profile(cid: str, session: AsyncSession = Depends(db.get_session)):
    profile = await CustomersRepository(session).profile(cid)
    if not profile:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _profile(profile)


@router.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerBody, session: AsyncSession = Depends(db.get_session)):
    repo = CustomersRepository(session)
    c = await repo.get(cid)
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    c.name = body.name
    c.phone = body.phone
    c.address = body.address
    c.notes = body.notes
    await session.commit()
    await session.refresh(c)
    return _customer(c)


# ---------- Orders ----------
ORDER_STATUSES = {"new", "in_progress", "making", "polishing", "ready", "delivered", "cancelled"}


class OrderItemBody(BaseModel):
    product_id: Optional[str] = None
    name: str
    metal: str = "gold"
    purity: str = "24K"
    weight_grams: float
    rate_per_tola: float
    jarti_percent: float = 0
    jyala_amount: float = 0
    jyala_type: str = "flat"
    stone_cost: float = 0
    polishing_cost: float = 0
    cutting_cost: float = 0
    worker_charge: float = 0
    other_cost: float = 0
    discount: float = 0


class InlineCustomerBody(BaseModel):
    name: str
    phone: str
    address: str = ""
    notes: str = ""


class OrderBody(BaseModel):
    customer_id: Optional[str] = None
    customer: Optional[InlineCustomerBody] = None
    customer_name: str = ""
    customer_phone: str = ""
    customer_address: str = ""
    order_type: str = "purchase"
    custom_description: str = ""
    delivery_date_ad: Optional[str] = None
    delivery_time: str = ""
    notes: str = ""
    old_gold: Optional[dict] = None
    items: list[OrderItemBody] = []


class OrderUpdateBody(BaseModel):
    order_type: Optional[str] = None
    custom_description: Optional[str] = None
    delivery_date_ad: Optional[str] = None
    delivery_time: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class StatusBody(BaseModel):
    status: str


def _payment(p) -> dict:
    return {
        "id": str(p.id), "payment_date_ad": _iso(p.payment_date_ad),
        "payment_date_bs": p.payment_date_bs, "payment_date_bs_np": p.payment_date_bs_np,
        "method": p.method, "note": p.note, "amount": float(p.amount),
    }


def _order_item(i) -> dict:
    return {
        "id": str(i.id), "product_id": str(i.product_id) if i.product_id else None,
        "name": i.name, "metal": i.metal, "purity": i.purity,
        "weight_grams": float(i.weight_grams), "weight_tola": float(i.weight_tola),
        "rate_per_tola": float(i.rate_per_tola), "purity_factor": float(i.purity_factor),
        "metal_value": float(i.metal_value), "jarti_percent": float(i.jarti_percent),
        "jarti_amount": float(i.jarti_amount), "jyala_type": i.jyala_type,
        "jyala_input": float(i.jyala_input), "jyala_amount": float(i.jyala_amount),
        "stone_cost": float(i.stone_cost), "polishing_cost": float(i.polishing_cost),
        "cutting_cost": float(i.cutting_cost), "worker_charge": float(i.worker_charge),
        "other_cost": float(i.other_cost), "discount": float(i.discount),
        "total_price": float(i.total_price),
    }


def _order(o) -> dict:
    return {
        "id": str(o.id), "order_number": o.order_number, "customer_id": str(o.customer_id),
        "customer_name": o.customer_name, "customer_phone": o.customer_phone,
        "order_type": o.order_type, "custom_description": o.custom_description,
        "reference_photo_url": o.reference_photo_url,
        "order_date_ad": _iso(o.order_date_ad), "order_date_bs": o.order_date_bs,
        "order_date_bs_np": o.order_date_bs_np,
        "delivery_date_ad": _iso(o.delivery_date_ad),
        "delivery_date_bs": o.delivery_date_bs, "delivery_date_bs_np": o.delivery_date_bs_np,
        "delivery_time": o.delivery_time, "status": o.status, "notes": o.notes,
        "old_gold": o.old_gold, "total_price": float(o.total_price),
        "old_gold_value": float(o.old_gold_value), "net_payable": float(o.net_payable),
        "advance_total": float(o.advance_total), "remaining_balance": float(o.remaining_balance),
        "payment_status": o.payment_status, "items": [_order_item(i) for i in o.items],
        "payments": [_payment(p) for p in o.payments],
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


async def _customer_for_order(body: OrderBody, session: AsyncSession):
    repo = CustomersRepository(session)
    if body.customer_id:
        customer = await repo.get(body.customer_id)
        if not customer or customer.is_deleted:
            raise HTTPException(status_code=404, detail="Customer not found")
        return customer
    inline = body.customer or InlineCustomerBody(
        name=body.customer_name, phone=body.customer_phone, address=body.customer_address)
    if not inline.name.strip() or not inline.phone.strip():
        raise HTTPException(status_code=400, detail="Customer is required")
    customer = repo.create(
        name=inline.name.strip(), phone=inline.phone.strip(),
        address=inline.address, notes=inline.notes,
    )
    await session.flush()
    return customer


def _validate_order_items(items: list[OrderItemBody]) -> list[dict]:
    if not items:
        raise HTTPException(status_code=400, detail="At least one order item is required")
    cleaned = []
    for item in items:
        if not item.name.strip():
            raise HTTPException(status_code=400, detail="Item name is required")
        if item.weight_grams <= 0:
            raise HTTPException(status_code=400, detail="Item weight must be greater than 0")
        if item.rate_per_tola <= 0:
            raise HTTPException(status_code=400, detail="Item rate must be greater than 0")
        cleaned.append(item.model_dump())
    return cleaned


def _apply_order_update(order, body: OrderUpdateBody):
    data = body.model_dump(exclude_unset=True)
    if "status" in data:
        status = data.pop("status")
        if status not in ORDER_STATUSES:
            raise HTTPException(status_code=400, detail="Invalid order status")
        order.status = status
    for key in ("order_type", "custom_description", "delivery_time", "notes"):
        if key in data:
            setattr(order, key, data[key] or "")
    if "delivery_date_ad" in data:
        delivery_date = OrdersRepository._date_or_none(data["delivery_date_ad"])
        delivery_bs = ad_to_bs(delivery_date) if delivery_date else {}
        order.delivery_date_ad = delivery_date
        order.delivery_date_bs = delivery_bs.get("bs_date")
        order.delivery_date_bs_np = delivery_bs.get("bs_date_np")


@router.get("/orders")
async def list_orders(status: Optional[str] = None, q: Optional[str] = None,
                      session: AsyncSession = Depends(db.get_session)):
    rows = await OrdersRepository(session).list(status=status)
    if q:
        ql = q.lower()
        rows = [o for o in rows if ql in (o.order_number or "").lower()
                or ql in o.customer_name.lower() or ql in o.customer_phone.lower()]
    return [_order(o) for o in rows]


@router.post("/orders")
async def create_order(body: OrderBody, session: AsyncSession = Depends(db.get_session)):
    customer = await _customer_for_order(body, session)
    try:
        order = await OrdersRepository(session).create_order(
            customer=customer,
            items=_validate_order_items(body.items),
            order_type=body.order_type,
            old_gold=body.old_gold,
            custom_description=body.custom_description,
            delivery_date_ad=body.delivery_date_ad,
            delivery_time=body.delivery_time,
            notes=body.notes,
        )
        await session.commit()
        await session.refresh(order)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return _order(order)


@router.get("/orders/{oid}")
async def get_order(oid: str, session: AsyncSession = Depends(db.get_session)):
    order = await OrdersRepository(session).get(oid)
    if not order or order.is_deleted:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order(order)


@router.put("/orders/{oid}")
async def put_order(oid: str, body: OrderUpdateBody, session: AsyncSession = Depends(db.get_session)):
    return await patch_order(oid, body, session)


@router.patch("/orders/{oid}")
async def patch_order(oid: str, body: OrderUpdateBody, session: AsyncSession = Depends(db.get_session)):
    order = await OrdersRepository(session).get(oid)
    if not order or order.is_deleted:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        _apply_order_update(order, body)
        await session.commit()
        await session.refresh(order)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return _order(order)


@router.patch("/orders/{oid}/status")
async def update_order_status(oid: str, body: StatusBody, session: AsyncSession = Depends(db.get_session)):
    if body.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid order status")
    order = await OrdersRepository(session).update_status(oid, body.status)
    if not order or order.is_deleted:
        raise HTTPException(status_code=404, detail="Order not found")
    await session.commit()
    await session.refresh(order)
    return _order(order)

"""Authenticated admin routes (S5C1: rates + reference data only).

Every route requires a valid Supabase admin JWT (get_current_admin, enforced at
the router level). Reads/writes go through the existing SQLAlchemy repos. Only
rates, categories, and collections are wired here; other admin domains follow in
later S5C slices.
"""
from datetime import date, datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

import db
import config
from models import Product
from repositories import (
    AdminTasksRepository, CategoriesRepository, CollectionsRepository, CustomersRepository,
    ExpensesRepository, LeadsRepository, MaterialTasksRepository, OrdersRepository, PaymentsRepository,
    ProductsRepository, RatesRepository, RepairsRepository, SettingsRepository,
    TemplatesRepository,
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


async def _signed_storage_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    if not path:
        return ""
    if not config.SUPABASE_URL or not config.SUPABASE_SERVICE_ROLE_KEY:
        return ""
    url = f"{config.SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}"
    headers = {
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_SERVICE_ROLE_KEY}",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json={"expiresIn": expires_in}, headers=headers)
            response.raise_for_status()
            signed = response.json().get("signedURL") or response.json().get("signedUrl") or ""
            return f"{config.SUPABASE_URL}/storage/v1{signed}" if signed.startswith("/") else signed
    except Exception:
        return ""


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
    cost_price: Optional[float] = None  # what the shop paid for this item; leave unset if unknown
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
        "cost_price": float(p.cost_price) if p.cost_price is not None else None,
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
    p.cost_price = body.cost_price
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


def _customer_due(row: dict) -> dict:
    customer = row["customer"]
    latest = row["latest_order"]
    return {
        "customer_id": str(customer.id),
        "customer_name": customer.name,
        "phone": customer.phone,
        "outstanding_balance": row["outstanding_balance"],
        "open_orders_count": row["open_orders_count"],
        "latest_order_id": str(latest.id) if latest else None,
        "latest_order_number": latest.order_number if latest else None,
        "latest_order_date_ad": _iso(latest.order_date_ad) if latest else None,
        "latest_order_status": latest.status if latest else None,
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


@router.get("/customers/dues")
async def customer_dues(session: AsyncSession = Depends(db.get_session)):
    rows = await CustomersRepository(session).dues()
    dues = [_customer_due(r) for r in rows]
    return {
        "total_outstanding": round(sum(d["outstanding_balance"] for d in dues), 2),
        "customers_with_dues": len(dues),
        "dues": dues,
    }


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


class PaymentBody(BaseModel):
    amount: float
    method: str = "cash"
    payment_date_ad: Optional[str] = None
    note: str = ""


class ExpenseBody(BaseModel):
    date_ad: Optional[str] = None
    category: str = "other"
    description: str = ""
    amount: float
    payment_method: str = "cash"


def _payment(p) -> dict:
    return {
        "id": str(p.id), "payment_date_ad": _iso(p.payment_date_ad),
        "payment_date_bs": p.payment_date_bs, "payment_date_bs_np": p.payment_date_bs_np,
        "method": p.method, "note": p.note, "amount": float(p.amount),
    }


def _expense(e) -> dict:
    return {
        "id": str(e.id),
        "date_ad": _iso(e.date_ad),
        "category": e.category,
        "description": e.description,
        "amount": float(e.amount),
        "payment_method": e.payment_method,
        "created_at": e.created_at.isoformat() if e.created_at else None,
        "updated_at": e.updated_at.isoformat() if e.updated_at else None,
    }


def _cashbook_entry(entry: dict) -> dict:
    return {**entry, "date_ad": _iso(entry["date_ad"])}


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
        "cost_price": float(i.cost_price) if i.cost_price is not None else None,
        "line_number": i.line_number,
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


async def _snapshot_item_cost_prices(items: list[dict], session: AsyncSession) -> list[dict]:
    """Attach cost_price from the linked Product, never trusting a client value.

    Custom/manual items (no product_id) keep cost_price unset (None) — unknown
    cost stays unknown, it is never treated as zero.
    """
    for item in items:
        product_id = item.get("product_id")
        item["cost_price"] = None
        if product_id:
            product = await session.get(Product, product_id)
            if product is not None and product.cost_price is not None:
                item["cost_price"] = float(product.cost_price)
    return items


@router.post("/orders")
async def create_order(body: OrderBody, session: AsyncSession = Depends(db.get_session)):
    customer = await _customer_for_order(body, session)
    try:
        items = await _snapshot_item_cost_prices(_validate_order_items(body.items), session)
        order = await OrdersRepository(session).create_order(
            customer=customer,
            items=items,
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


@router.get("/orders/{oid}/payments")
async def list_order_payments(oid: str, session: AsyncSession = Depends(db.get_session)):
    order = await OrdersRepository(session).get(oid)
    if not order or order.is_deleted:
        raise HTTPException(status_code=404, detail="Order not found")
    return [_payment(p) for p in order.payments]


@router.post("/orders/{oid}/payments")
async def add_order_payment(oid: str, body: PaymentBody, session: AsyncSession = Depends(db.get_session)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
    order = await OrdersRepository(session).get(oid)
    if not order or order.is_deleted:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        payment = await PaymentsRepository(session).add_payment(
            order=order,
            amount=body.amount,
            method=body.method,
            payment_date_ad=body.payment_date_ad,
            note=body.note,
        )
        await session.commit()
        await session.refresh(order)
        await session.refresh(payment)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "payment": _payment(payment),
        "advance_total": float(order.advance_total),
        "remaining_balance": float(order.remaining_balance),
        "payment_status": order.payment_status,
    }


# ---------- Expenses / cashbook ----------
@router.get("/expenses")
async def list_expenses(start_date: Optional[str] = None, end_date: Optional[str] = None,
                        session: AsyncSession = Depends(db.get_session)):
    try:
        rows = await ExpensesRepository(session).list(start_date=start_date, end_date=end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return [_expense(e) for e in rows]


@router.post("/expenses")
async def create_expense(body: ExpenseBody, session: AsyncSession = Depends(db.get_session)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")
    try:
        expense = ExpensesRepository(session).create(
            date_ad=body.date_ad,
            category=body.category,
            description=body.description,
            amount=body.amount,
            payment_method=body.payment_method,
        )
        await session.commit()
        await session.refresh(expense)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return _expense(expense)


@router.patch("/expenses/{eid}")
async def patch_expense(eid: str, body: ExpenseBody, session: AsyncSession = Depends(db.get_session)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")
    repo = ExpensesRepository(session)
    expense = await repo.get(eid)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    try:
        expense.date_ad = repo._date_or_today(body.date_ad)
        expense.category = body.category or "other"
        expense.description = body.description or ""
        expense.amount = body.amount
        expense.payment_method = body.payment_method or "cash"
        await session.commit()
        await session.refresh(expense)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return _expense(expense)


@router.get("/cashbook")
async def cashbook(start_date: Optional[str] = None, end_date: Optional[str] = None,
                   session: AsyncSession = Depends(db.get_session)):
    try:
        data = await ExpensesRepository(session).cashbook(start_date=start_date, end_date=end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {**data, "entries": [_cashbook_entry(e) for e in data["entries"]]}


# ---------- Leads ----------
LEAD_STATUSES = {"new", "contacted", "converted", "closed"}


class LeadUpdateBody(BaseModel):
    lead_type: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    item_type: Optional[str] = None
    metal: Optional[str] = None
    service_type: Optional[str] = None
    approx_weight: Optional[str] = None
    budget: Optional[str] = None
    deadline: Optional[str] = None
    notes: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None


async def _lead(l) -> dict:
    photo = await _signed_storage_url("lead-photos", l.photo_url)
    return {
        "id": str(l.id), "lead_type": l.lead_type, "name": l.name, "phone": l.phone,
        "item_type": l.item_type, "metal": l.metal, "service_type": l.service_type,
        "approx_weight": l.approx_weight, "budget": l.budget, "deadline": l.deadline,
        "notes": l.notes, "photo_url": l.photo_url, "photo": photo,
        "status": l.status, "created_at": l.created_at.isoformat() if l.created_at else None,
        "updated_at": l.updated_at.isoformat() if l.updated_at else None,
    }


async def _lead_list(rows) -> list[dict]:
    return [await _lead(row) for row in rows]


def _apply_lead_update(lead, body: LeadUpdateBody):
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid lead status")
    if "lead_type" in data and data["lead_type"] not in ("custom_order", "repair"):
        raise HTTPException(status_code=400, detail="Invalid lead type")
    for key, value in data.items():
        setattr(lead, key, value or "")


@router.get("/leads")
async def list_leads(status: Optional[str] = None, session: AsyncSession = Depends(db.get_session)):
    rows = await LeadsRepository(session).list(status=status)
    return await _lead_list(rows)


@router.get("/leads/{lid}")
async def get_lead(lid: str, session: AsyncSession = Depends(db.get_session)):
    lead = await LeadsRepository(session).get(lid)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return await _lead(lead)


@router.patch("/leads/{lid}")
async def patch_lead(lid: str, body: LeadUpdateBody, session: AsyncSession = Depends(db.get_session)):
    lead = await LeadsRepository(session).get(lid)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    _apply_lead_update(lead, body)
    await session.commit()
    await session.refresh(lead)
    return await _lead(lead)


@router.patch("/leads/{lid}/status")
async def update_lead_status(lid: str, body: StatusBody, session: AsyncSession = Depends(db.get_session)):
    return await patch_lead(lid, LeadUpdateBody(status=body.status), session)


# ---------- Repairs ----------
REPAIR_STATUSES = {"received", "working", "ready", "delivered", "cancelled"}


class RepairBody(BaseModel):
    customer_id: str
    service_type: str = "repair"
    description: str = ""
    intake_photo_url: str = ""
    damage_photo_url: str = ""
    after_photo_url: str = ""
    intake_photo: str = ""
    damage_photo: str = ""
    after_photo: str = ""
    promised_date_ad: Optional[str] = None
    charge: float = 0
    status: str = "received"


class RepairUpdateBody(BaseModel):
    service_type: Optional[str] = None
    description: Optional[str] = None
    intake_photo_url: Optional[str] = None
    damage_photo_url: Optional[str] = None
    after_photo_url: Optional[str] = None
    intake_photo: Optional[str] = None
    damage_photo: Optional[str] = None
    after_photo: Optional[str] = None
    promised_date_ad: Optional[str] = None
    charge: Optional[float] = None
    status: Optional[str] = None


async def _repair(r) -> dict:
    intake_photo = await _signed_storage_url("repair-photos", r.intake_photo_url)
    damage_photo = await _signed_storage_url("repair-photos", r.damage_photo_url)
    after_photo = await _signed_storage_url("repair-photos", r.after_photo_url)
    return {
        "id": str(r.id), "repair_number": r.repair_number, "customer_id": str(r.customer_id),
        "customer_name": r.customer_name, "customer_phone": r.customer_phone,
        "service_type": r.service_type, "description": r.description,
        "intake_photo_url": r.intake_photo_url, "damage_photo_url": r.damage_photo_url,
        "after_photo_url": r.after_photo_url, "intake_photo": intake_photo,
        "damage_photo": damage_photo, "after_photo": after_photo,
        "promised_date_ad": _iso(r.promised_date_ad),
        "promised_date_bs": r.promised_date_bs, "promised_date_bs_np": r.promised_date_bs_np,
        "charge": float(r.charge), "paid_amount": float(r.paid_amount),
        "status": r.status, "is_deleted": r.is_deleted,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


async def _repair_list(rows) -> list[dict]:
    return [await _repair(row) for row in rows]


def _private_path(primary: Optional[str], alias: Optional[str]) -> str:
    return primary or alias or ""


def _validate_repair_fields(service_type: Optional[str] = None, status: Optional[str] = None):
    if service_type is not None and service_type not in ("repair", "polish", "cleaning"):
        raise HTTPException(status_code=400, detail="Invalid service type")
    if status is not None and status not in REPAIR_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid repair status")


def _apply_repair_update(repair, body: RepairUpdateBody):
    data = body.model_dump(exclude_unset=True)
    _validate_repair_fields(data.get("service_type"), data.get("status"))
    for key in ("service_type", "description", "status"):
        if key in data:
            setattr(repair, key, data[key] or "")
    if "charge" in data:
        repair.charge = data["charge"] or 0
    if "intake_photo_url" in data or "intake_photo" in data:
        repair.intake_photo_url = _private_path(data.get("intake_photo_url"), data.get("intake_photo"))
    if "damage_photo_url" in data or "damage_photo" in data:
        repair.damage_photo_url = _private_path(data.get("damage_photo_url"), data.get("damage_photo"))
    if "after_photo_url" in data or "after_photo" in data:
        repair.after_photo_url = _private_path(data.get("after_photo_url"), data.get("after_photo"))
    if "promised_date_ad" in data:
        promised = RepairsRepository._date_or_none(data["promised_date_ad"])
        promised_bs = ad_to_bs(promised) if promised else {}
        repair.promised_date_ad = promised
        repair.promised_date_bs = promised_bs.get("bs_date")
        repair.promised_date_bs_np = promised_bs.get("bs_date_np")


@router.get("/repairs")
async def list_repairs(status: Optional[str] = None, session: AsyncSession = Depends(db.get_session)):
    rows = await RepairsRepository(session).list(status=status)
    return await _repair_list(rows)


@router.post("/repairs")
async def create_repair(body: RepairBody, session: AsyncSession = Depends(db.get_session)):
    _validate_repair_fields(body.service_type, body.status)
    customer = await CustomersRepository(session).get(body.customer_id)
    if not customer or customer.is_deleted:
        raise HTTPException(status_code=404, detail="Customer not found")
    try:
        repair = await RepairsRepository(session).create_repair(
            customer=customer,
            service_type=body.service_type,
            description=body.description,
            promised_date_ad=body.promised_date_ad,
            charge=body.charge,
            status=body.status,
            intake_photo_url=_private_path(body.intake_photo_url, body.intake_photo),
            damage_photo_url=_private_path(body.damage_photo_url, body.damage_photo),
            after_photo_url=_private_path(body.after_photo_url, body.after_photo),
        )
        await session.commit()
        await session.refresh(repair)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return await _repair(repair)


@router.get("/repairs/{rid}")
async def get_repair(rid: str, session: AsyncSession = Depends(db.get_session)):
    repair = await RepairsRepository(session).get(rid)
    if not repair or repair.is_deleted:
        raise HTTPException(status_code=404, detail="Repair not found")
    return await _repair(repair)


@router.put("/repairs/{rid}")
async def put_repair(rid: str, body: RepairUpdateBody, session: AsyncSession = Depends(db.get_session)):
    return await patch_repair(rid, body, session)


@router.patch("/repairs/{rid}")
async def patch_repair(rid: str, body: RepairUpdateBody, session: AsyncSession = Depends(db.get_session)):
    repair = await RepairsRepository(session).get(rid)
    if not repair or repair.is_deleted:
        raise HTTPException(status_code=404, detail="Repair not found")
    try:
        _apply_repair_update(repair, body)
        await session.commit()
        await session.refresh(repair)
    except ValueError as exc:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return await _repair(repair)


# ---------- Dashboard ----------
def _repair_summary(r) -> dict:
    return {
        "id": str(r.id), "repair_number": r.repair_number, "customer_name": r.customer_name,
        "service_type": r.service_type, "status": r.status,
        "promised_date_ad": _iso(r.promised_date_ad),
    }


def _lead_summary(l) -> dict:
    return {
        "id": str(l.id), "lead_type": l.lead_type, "name": l.name, "phone": l.phone,
        "status": l.status, "created_at": l.created_at.isoformat() if l.created_at else None,
    }


def _order_summary(o) -> dict:
    """Lightweight order shape for dashboard previews only -- no items/payments
    (those relationships are explicitly noload'd on these queries; touching
    them here would trigger a lazy-load error in an async session)."""
    return {
        "id": str(o.id), "order_number": o.order_number, "customer_name": o.customer_name,
        "customer_phone": o.customer_phone, "status": o.status,
        "delivery_date_ad": _iso(o.delivery_date_ad),
        "remaining_balance": float(o.remaining_balance),
    }


# Dashboard preview list caps -- small, fixed-size previews only. The shop is
# small enough that these limits rarely truncate real data; the "(count)"
# labels in the UI reflect the capped list length, not a separate exact
# total, trading perfect accuracy at that edge for a bounded, fast payload.
_DASHBOARD_LIST_LIMIT = 10
_DASHBOARD_REPAIRS_LIMIT = 8
_DASHBOARD_LEADS_LIMIT = 5


@router.get("/dashboard")
async def dashboard(session: AsyncSession = Depends(db.get_session)):
    orders_repo = OrdersRepository(session)
    rate = await RatesRepository(session).latest()
    due_today = await orders_repo.due_today(limit=_DASHBOARD_LIST_LIMIT)
    due_week = await orders_repo.due_this_week(limit=_DASHBOARD_LIST_LIMIT)
    ready = await orders_repo.ready_for_collection(limit=_DASHBOARD_LIST_LIMIT)
    pending_pay = await orders_repo.pending_payments(limit=_DASHBOARD_LIST_LIMIT)
    todays_sales = await PaymentsRepository(session).todays_total()
    pending_orders_count = await orders_repo.active_count()
    new_leads = await LeadsRepository(session).count_new()

    repairs_repo = RepairsRepository(session)
    pending_repairs_count = await repairs_repo.count_pending()
    pending_repairs = await repairs_repo.list_pending(limit=_DASHBOARD_REPAIRS_LIMIT)

    recent_leads = await LeadsRepository(session).list(limit=_DASHBOARD_LEADS_LIMIT)

    return {
        "rate": _rate(rate) if rate else None,
        "orders_due_today": [_order_summary(o) for o in due_today],
        "orders_due_week": [_order_summary(o) for o in due_week],
        "ready_for_collection": [_order_summary(o) for o in ready],
        "pending_payments": [_order_summary(o) for o in pending_pay],
        "todays_sales": todays_sales,
        "todays_invoices": 0,
        "pending_orders_count": pending_orders_count,
        "new_leads": new_leads,
        "pending_repairs_count": pending_repairs_count,
        "pending_repairs": [_repair_summary(r) for r in pending_repairs],
        "recent_leads": [_lead_summary(l) for l in recent_leads],
    }


# ---------- Admin tasks / reminders ----------
def _to_date(value) -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date() if "T" in value else date.fromisoformat(value)
    raise HTTPException(status_code=400, detail="Invalid date value")


class TaskBody(BaseModel):
    title: str
    description: str = ""
    related_order_id: Optional[str] = None
    related_customer_id: Optional[str] = None
    due_date_ad: Optional[str] = None
    assigned_to: str = ""
    priority: str = "normal"
    status: str = "pending"


class TaskUpdateBody(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    related_order_id: Optional[str] = None
    related_customer_id: Optional[str] = None
    due_date_ad: Optional[str] = None
    assigned_to: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


def _task(t) -> dict:
    return {
        "id": str(t.id), "title": t.title, "description": t.description,
        "related_order_id": str(t.related_order_id) if t.related_order_id else None,
        "related_customer_id": str(t.related_customer_id) if t.related_customer_id else None,
        "due_date_ad": _iso(t.due_date_ad), "assigned_to": t.assigned_to,
        "priority": t.priority, "status": t.status,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/tasks")
async def list_tasks(status: Optional[str] = None, session: AsyncSession = Depends(db.get_session)):
    rows = await AdminTasksRepository(session).list(status=status)
    return [_task(t) for t in rows]


@router.post("/tasks")
async def create_task(body: TaskBody, session: AsyncSession = Depends(db.get_session)):
    task = AdminTasksRepository(session).create(
        title=body.title, description=body.description,
        related_order_id=body.related_order_id, related_customer_id=body.related_customer_id,
        due_date_ad=_to_date(body.due_date_ad), assigned_to=body.assigned_to,
        priority=body.priority, status=body.status,
    )
    await session.commit()
    await session.refresh(task)
    return _task(task)


@router.patch("/tasks/{tid}")
async def patch_task(tid: str, body: TaskUpdateBody, session: AsyncSession = Depends(db.get_session)):
    task = await AdminTasksRepository(session).get(tid)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    data = body.model_dump(exclude_unset=True)
    if "due_date_ad" in data:
        task.due_date_ad = _to_date(data.pop("due_date_ad"))
    for key, value in data.items():
        setattr(task, key, value)
    await session.commit()
    await session.refresh(task)
    return _task(task)


# ---------- Material tasks (per-order material tracking) ----------
class MaterialTaskUpdateBody(BaseModel):
    material_needed: Optional[str] = None
    material_status: Optional[str] = None
    assigned_to: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None


def _material_task(t) -> dict:
    return {
        "id": str(t.id), "order_id": str(t.order_id), "material_needed": t.material_needed,
        "material_status": t.material_status, "assigned_to": t.assigned_to,
        "quantity": t.quantity, "notes": t.notes,
        "purchased_at": t.purchased_at.isoformat() if t.purchased_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/material-tasks")
async def list_material_tasks(order_id: Optional[str] = None, status: Optional[str] = None,
                               session: AsyncSession = Depends(db.get_session)):
    repo = MaterialTasksRepository(session)
    if order_id:
        rows = await repo.list_for_order(order_id)
    elif status:
        rows = await repo.list_by_status(status)
    else:
        rows = await repo.list()
    return [_material_task(t) for t in rows]


@router.patch("/material-tasks/{mid}")
async def patch_material_task(mid: str, body: MaterialTaskUpdateBody,
                              session: AsyncSession = Depends(db.get_session)):
    repo = MaterialTasksRepository(session)
    task = await repo.get(mid)
    if not task:
        raise HTTPException(status_code=404, detail="Material task not found")
    if body.material_status == "purchased" and task.material_status != "purchased":
        await repo.mark_purchased(mid)
        await session.refresh(task)
        data = body.model_dump(exclude_unset=True, exclude={"material_status"})
    else:
        data = body.model_dump(exclude_unset=True)
        if "material_status" in data:
            task.material_status = data.pop("material_status")
    for key, value in data.items():
        setattr(task, key, value)
    await session.commit()
    await session.refresh(task)
    return _material_task(task)


# ---------- WhatsApp templates (manual wa.me links only; no paid API, no auto-send) ----------
class TemplateUpdateBody(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def _template(t) -> dict:
    return {
        "id": str(t.id), "slug": t.slug, "name": t.name, "body": t.body,
        "is_active": t.is_active, "sort_order": t.sort_order,
    }


@router.get("/templates")
async def list_templates(session: AsyncSession = Depends(db.get_session)):
    rows = await TemplatesRepository(session).list(order_by=TemplatesRepository.model.sort_order)
    return [_template(t) for t in rows]


@router.patch("/templates/{tpid}")
async def patch_template(tpid: str, body: TemplateUpdateBody, session: AsyncSession = Depends(db.get_session)):
    repo = TemplatesRepository(session)
    template = await repo.get(tpid)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(template, key, value)
    await session.commit()
    await session.refresh(template)
    return _template(template)


# ---------- Shop settings ----------
class SettingsBody(BaseModel):
    shop_name: Optional[str] = None
    shop_name_np: Optional[str] = None
    tagline: Optional[str] = None
    tagline_np: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    address: Optional[str] = None
    maps_link: Optional[str] = None
    opening_hours: Optional[str] = None
    logo: Optional[str] = None
    default_whatsapp_message: Optional[str] = None


def _settings(row) -> dict:
    return {
        "shop_name": row.shop_name, "shop_name_np": row.shop_name_np,
        "tagline": row.tagline, "tagline_np": row.tagline_np,
        "phone": row.phone, "whatsapp": row.whatsapp, "address": row.address,
        "maps_link": row.maps_link, "opening_hours": row.opening_hours,
        "logo": row.logo_url, "default_whatsapp_message": row.default_whatsapp_message,
    }


@router.get("/settings")
async def get_settings(session: AsyncSession = Depends(db.get_session)):
    row = await SettingsRepository(session).get_settings()
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    return _settings(row)


@router.put("/settings")
async def update_settings(body: SettingsBody, session: AsyncSession = Depends(db.get_session)):
    data = body.model_dump(exclude_unset=True)
    if "logo" in data:
        data["logo_url"] = data.pop("logo")
    row = await SettingsRepository(session).update_settings(**data)
    if not row:
        raise HTTPException(status_code=404, detail="Settings not found")
    await session.commit()
    await session.refresh(row)
    return _settings(row)


# ---------- Reports (read-only summaries; no new business logic) ----------
@router.get("/reports")
async def reports(session: AsyncSession = Depends(db.get_session)):
    orders_repo = OrdersRepository(session)
    products_repo = ProductsRepository(session)
    due_week = await orders_repo.due_this_week()
    pending = await orders_repo.pending_payments()
    todays_sales = await PaymentsRepository(session).todays_total()
    return {
        "todays_sales": todays_sales,
        "orders_due_week": len(due_week),
        "pending_payments_total": round(sum(float(o.remaining_balance) for o in pending), 2),
        "pending_payments_count": len(pending),
        "available_stock": await products_repo.count_by_status("available"),
        "reserved_stock": await products_repo.count_by_status("reserved"),
        "sold_stock": await products_repo.count_by_status("sold"),
    }

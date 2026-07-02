from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Response, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from utils import (to_nepali_digits, ad_to_bs, grams_to_tola, tola_lal_aana_to_grams,
                   compute_price, mask_name, PURITY_FACTORS, GRAMS_PER_TOLA)
from auth import hash_password, verify_password, create_access_token, get_current_admin

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

now_iso = lambda: datetime.now(timezone.utc).isoformat()
today_str = lambda: date.today().isoformat()


async def next_seq(name: str) -> int:
    doc = await db.counters.find_one_and_update(
        {"_id": name}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
    return doc["seq"]


# ---------- Models ----------
class LoginBody(BaseModel):
    email: str
    password: str


class RateBody(BaseModel):
    date_ad: str = Field(default_factory=today_str)
    gold_24k: float
    gold_22k: float
    silver: float


class WeightInput(BaseModel):
    grams: Optional[float] = None
    tola: Optional[float] = None
    lal: Optional[float] = None
    aana: Optional[float] = None


class ProductBody(BaseModel):
    name: str
    name_np: Optional[str] = ""
    description: Optional[str] = ""
    category: Optional[str] = ""
    collection: Optional[str] = ""
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
    photos: List[str] = []


class CustomerBody(BaseModel):
    name: str
    phone: str
    address: Optional[str] = ""
    notes: Optional[str] = ""


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


class OldGoldBody(BaseModel):
    old_item_description: str = ""
    old_weight_tola: float = 0
    old_valuation_rate_per_tola: float = 0
    old_deduction_percent: float = 0


class OrderBody(BaseModel):
    customer_id: str
    order_type: str = "purchase"
    items: List[OrderItemBody] = []
    custom_description: Optional[str] = ""
    reference_photo: Optional[str] = ""
    delivery_date_ad: Optional[str] = None
    delivery_time: Optional[str] = ""
    notes: Optional[str] = ""
    old_gold: Optional[OldGoldBody] = None


class PaymentBody(BaseModel):
    amount: float
    payment_date_ad: str = Field(default_factory=today_str)
    method: str = "cash"
    note: Optional[str] = ""


class InvoiceBody(BaseModel):
    order_id: str
    bill_number: str
    invoice_date_ad: str = Field(default_factory=today_str)
    physical_bill_photo: Optional[str] = ""


class RepairBody(BaseModel):
    customer_id: str
    service_type: str = "repair"
    description: str = ""
    intake_photo: Optional[str] = ""
    damage_photo: Optional[str] = ""
    after_photo: Optional[str] = ""
    promised_date_ad: Optional[str] = None
    charge: float = 0
    status: str = "received"


class CertificateBody(BaseModel):
    product_id: Optional[str] = None
    order_id: Optional[str] = None
    metal: str = "gold"
    purity: str = "24K"
    weight_grams: float
    stone_details: Optional[str] = ""
    date_ad: str = Field(default_factory=today_str)


class LeadBody(BaseModel):
    lead_type: str = "custom_order"
    name: str
    phone: str
    item_type: Optional[str] = ""
    metal: Optional[str] = ""
    service_type: Optional[str] = ""
    approx_weight: Optional[str] = ""
    budget: Optional[str] = ""
    deadline: Optional[str] = ""
    notes: Optional[str] = ""
    photo: Optional[str] = ""


class StatusUpdate(BaseModel):
    status: str


# ---------- Helpers ----------
def clean(doc):
    if doc:
        doc.pop("_id", None)
    return doc


async def get_today_rate():
    return clean(await db.daily_rates.find_one({}, sort=[("date_ad", -1)]))


def product_public_view(p, rate):
    computed = None
    if rate and p.get("show_price_on_website"):
        rpt = rate["gold_24k"] if p["metal"] == "gold" else rate["silver"]
        computed = compute_price(p["weight_grams"], rpt, p["purity"], p["jarti_percent"],
                                 p["jyala_amount"], p["jyala_type"], p["stone_cost"],
                                 p["polishing_cost"], p["cutting_cost"], p["worker_charge"],
                                 p["other_cost"])["total_price"]
    return {
        "id": p["id"], "product_code": p["product_code"], "name": p["name"],
        "name_np": p.get("name_np", ""), "description": p.get("description", ""),
        "category": p.get("category", ""), "collection": p.get("collection", ""),
        "metal": p["metal"], "purity": p["purity"],
        "weight_grams": p["weight_grams"], "weight_tola": grams_to_tola(p["weight_grams"]),
        "status": p["status"], "photos": p.get("photos", []),
        "estimated_price": computed,
        "show_price_on_website": p.get("show_price_on_website", False),
    }


def enrich_product_price(p, rate):
    if rate:
        rpt = rate["gold_24k"] if p["metal"] == "gold" else rate["silver"]
        p["live_price"] = compute_price(p["weight_grams"], rpt, p["purity"], p["jarti_percent"],
                                        p["jyala_amount"], p["jyala_type"], p["stone_cost"],
                                        p["polishing_cost"], p["cutting_cost"], p["worker_charge"],
                                        p["other_cost"])
    p["weight_tola"] = grams_to_tola(p["weight_grams"])
    return p


async def recompute_order_balance(order_id: str):
    order = await db.orders.find_one({"id": order_id})
    payments = await db.payments.find({"order_id": order_id}).to_list(500)
    advance = sum(p["amount"] for p in payments)
    remaining = round(order["net_payable"] - advance, 2)
    await db.orders.update_one({"id": order_id}, {"$set": {"advance_total": advance, "remaining_balance": remaining, "updated_at": now_iso()}})
    return advance, remaining


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginBody, response: Response):
    user = await db.users.find_one({"email": body.email.lower().strip()})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "Admin"), "token": token}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(admin=Depends(get_current_admin)):
    return admin


# ---------- Daily Rates ----------
@api.post("/admin/rates")
async def set_rate(body: RateBody, admin=Depends(get_current_admin)):
    bs = ad_to_bs(body.date_ad)
    doc = {"id": str(uuid.uuid4()), "date_ad": body.date_ad, **bs,
           "gold_24k": body.gold_24k, "gold_22k": body.gold_22k, "silver": body.silver,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.daily_rates.update_one({"date_ad": body.date_ad}, {"$set": doc}, upsert=True)
    return doc


@api.get("/rates/today")
async def rate_today():
    rate = await get_today_rate()
    if not rate:
        return None
    rate["gold_24k_np"] = to_nepali_digits(f"{rate['gold_24k']:,.0f}")
    rate["gold_22k_np"] = to_nepali_digits(f"{rate['gold_22k']:,.0f}")
    rate["silver_np"] = to_nepali_digits(f"{rate['silver']:,.0f}")
    return rate


@api.get("/rates/history")
async def rate_history(days: int = 30):
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    rates = await db.daily_rates.find({"date_ad": {"$gte": cutoff}}, {"_id": 0}).sort("date_ad", 1).to_list(400)
    return rates


# ---------- Categories & Collections ----------
@api.get("/categories")
async def get_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(100)


@api.get("/collections")
async def get_collections():
    return await db.collections.find({}, {"_id": 0}).to_list(100)


# ---------- Products ----------
@api.post("/admin/products")
async def create_product(body: ProductBody, admin=Depends(get_current_admin)):
    w = body.weight
    grams = w.grams if w.grams else tola_lal_aana_to_grams(w.tola or 0, w.lal or 0, w.aana or 0)
    if grams <= 0:
        raise HTTPException(status_code=400, detail="Weight must be greater than 0")
    seq = await next_seq("product")
    doc = body.model_dump(exclude={"weight"})
    doc.update({"id": str(uuid.uuid4()), "product_code": f"JSD-P-{seq:04d}",
                "weight_grams": grams, "is_deleted": False,
                "created_at": now_iso(), "updated_at": now_iso()})
    await db.products.insert_one(dict(doc))
    return enrich_product_price(doc, await get_today_rate())


@api.get("/admin/products")
async def list_products_admin(status: Optional[str] = None, metal: Optional[str] = None,
                              q: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {"is_deleted": False}
    if status:
        query["status"] = status
    if metal:
        query["metal"] = metal
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"product_code": {"$regex": q, "$options": "i"}}]
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    rate = await get_today_rate()
    return [enrich_product_price(p, rate) for p in products]


@api.get("/admin/products/{pid}")
async def get_product_admin(pid: str, admin=Depends(get_current_admin)):
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return enrich_product_price(p, await get_today_rate())


@api.put("/admin/products/{pid}")
async def update_product(pid: str, body: ProductBody, admin=Depends(get_current_admin)):
    w = body.weight
    grams = w.grams if w.grams else tola_lal_aana_to_grams(w.tola or 0, w.lal or 0, w.aana or 0)
    doc = body.model_dump(exclude={"weight"})
    doc.update({"weight_grams": grams, "updated_at": now_iso()})
    res = await db.products.update_one({"id": pid}, {"$set": doc})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    p = await db.products.find_one({"id": pid}, {"_id": 0})
    return enrich_product_price(p, await get_today_rate())


@api.delete("/admin/products/{pid}")
async def soft_delete_product(pid: str, admin=Depends(get_current_admin)):
    await db.products.update_one({"id": pid}, {"$set": {"is_deleted": True, "status": "inactive", "updated_at": now_iso()}})
    return {"ok": True}


@api.get("/products")
async def public_products(metal: Optional[str] = None, category: Optional[str] = None,
                          collection: Optional[str] = None, availability: Optional[str] = None):
    query = {"is_deleted": False, "show_on_website": True, "status": {"$nin": ["sold", "inactive"]}}
    if metal:
        query["metal"] = metal
    if category:
        query["category"] = category
    if collection:
        query["collection"] = collection
    if availability:
        query["status"] = availability
    products = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    rate = await get_today_rate()
    return [product_public_view(p, rate) for p in products]


@api.get("/products/{pid}")
async def public_product_detail(pid: str):
    p = await db.products.find_one({"$or": [{"id": pid}, {"product_code": pid}], "is_deleted": False, "show_on_website": True}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return product_public_view(p, await get_today_rate())


# ---------- Customers ----------
@api.post("/admin/customers")
async def create_customer(body: CustomerBody, admin=Depends(get_current_admin)):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()})
    await db.customers.insert_one(dict(doc))
    return doc


@api.get("/admin/customers")
async def list_customers(q: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {"is_deleted": False}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"phone": {"$regex": q}}]
    return await db.customers.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.put("/admin/customers/{cid}")
async def update_customer(cid: str, body: CustomerBody, admin=Depends(get_current_admin)):
    await db.customers.update_one({"id": cid}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    return clean(await db.customers.find_one({"id": cid}))


@api.get("/admin/customers/{cid}")
async def customer_profile(cid: str, admin=Depends(get_current_admin)):
    c = await db.customers.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    orders = await db.orders.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    payments = await db.payments.find({"customer_id": cid}, {"_id": 0}).sort("payment_date_ad", -1).to_list(500)
    repairs = await db.repair_jobs.find({"customer_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    outstanding = sum(o.get("remaining_balance", 0) for o in orders if o.get("status") not in ("cancelled",))
    return {**c, "orders": orders, "payments": payments, "repairs": repairs, "total_outstanding": round(outstanding, 2)}


# ---------- Orders ----------
@api.post("/admin/orders")
async def create_order(body: OrderBody, admin=Depends(get_current_admin)):
    customer = await db.customers.find_one({"id": body.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    items = []
    total = 0.0
    for it in body.items:
        snap = compute_price(it.weight_grams, it.rate_per_tola, it.purity, it.jarti_percent,
                             it.jyala_amount, it.jyala_type, it.stone_cost, it.polishing_cost,
                             it.cutting_cost, it.worker_charge, it.other_cost, it.discount)
        items.append({"id": str(uuid.uuid4()), "product_id": it.product_id, "name": it.name,
                      "metal": it.metal, **snap})
        total += snap["total_price"]
        if it.product_id:
            await db.products.update_one({"id": it.product_id}, {"$set": {"status": "reserved", "updated_at": now_iso()}})
    og = body.old_gold.model_dump() if body.old_gold else None
    old_value = 0.0
    if og and og["old_weight_tola"] > 0:
        old_value = round(og["old_weight_tola"] * og["old_valuation_rate_per_tola"] * (1 - og["old_deduction_percent"] / 100.0), 2)
        og["old_weight_grams"] = round(og["old_weight_tola"] * GRAMS_PER_TOLA, 3)
        og["old_gold_value"] = old_value
    net = round(total - old_value, 2)
    seq = await next_seq("order")
    order_bs = ad_to_bs(today_str())
    delivery_bs = ad_to_bs(body.delivery_date_ad) if body.delivery_date_ad else {}
    doc = {"id": str(uuid.uuid4()), "order_number": f"ORD-{seq:04d}",
           "customer_id": body.customer_id, "customer_name": customer["name"], "customer_phone": customer["phone"],
           "order_type": body.order_type, "items": items,
           "custom_description": body.custom_description, "reference_photo": body.reference_photo,
           "order_date_ad": today_str(), "order_date_bs": order_bs["bs_date"], "order_date_bs_np": order_bs["bs_date_np"],
           "delivery_date_ad": body.delivery_date_ad, "delivery_date_bs": delivery_bs.get("bs_date"),
           "delivery_date_bs_np": delivery_bs.get("bs_date_np"), "delivery_time": body.delivery_time,
           "status": "new", "notes": body.notes, "old_gold": og,
           "total_price": round(total, 2), "old_gold_value": old_value, "net_payable": net,
           "advance_total": 0.0, "remaining_balance": net, "is_deleted": False,
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.orders.insert_one(dict(doc))
    return doc


@api.get("/admin/orders")
async def list_orders(status: Optional[str] = None, q: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {"is_deleted": False}
    if status:
        query["status"] = status
    if q:
        query["$or"] = [{"order_number": {"$regex": q, "$options": "i"}},
                        {"customer_name": {"$regex": q, "$options": "i"}},
                        {"customer_phone": {"$regex": q}}]
    return await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/admin/orders/{oid}")
async def get_order(oid: str, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": oid}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order["payments"] = await db.payments.find({"order_id": oid}, {"_id": 0}).sort("payment_date_ad", 1).to_list(200)
    return order


@api.patch("/admin/orders/{oid}/status")
async def update_order_status(oid: str, body: StatusUpdate, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one({"id": oid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    product_status = {"delivered": "sold", "cancelled": "available"}.get(body.status)
    if product_status:
        for it in order.get("items", []):
            if it.get("product_id"):
                await db.products.update_one({"id": it["product_id"]}, {"$set": {"status": product_status, "updated_at": now_iso()}})
    return clean(await db.orders.find_one({"id": oid}))


# ---------- Payments ----------
@api.post("/admin/orders/{oid}/payments")
async def add_payment(oid: str, body: PaymentBody, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    bs = ad_to_bs(body.payment_date_ad)
    doc = {"id": str(uuid.uuid4()), "order_id": oid, "customer_id": order["customer_id"],
           **body.model_dump(), "payment_date_bs": bs["bs_date"], "payment_date_bs_np": bs["bs_date_np"],
           "created_at": now_iso()}
    await db.payments.insert_one(dict(doc))
    advance, remaining = await recompute_order_balance(oid)
    return {"payment": doc, "advance_total": advance, "remaining_balance": remaining}


# ---------- Invoices ----------
@api.post("/admin/invoices")
async def create_invoice(body: InvoiceBody, admin=Depends(get_current_admin)):
    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    existing = await db.invoices.find_one({"bill_number": body.bill_number, "status": {"$ne": "cancelled"}})
    if existing:
        raise HTTPException(status_code=400, detail=f"Bill number {body.bill_number} already used")
    customer = await db.customers.find_one({"id": order["customer_id"]}, {"_id": 0})
    bs = ad_to_bs(body.invoice_date_ad)
    doc = {"id": str(uuid.uuid4()), "bill_number": body.bill_number, "order_id": body.order_id,
           "order_number": order["order_number"],
           "invoice_date_ad": body.invoice_date_ad, "invoice_date_bs": bs["bs_date"],
           "invoice_date_bs_np": bs["bs_date_np"], "invoice_date_bs_long_np": bs["bs_date_long_np"],
           "customer": {"name": customer["name"], "phone": customer["phone"], "address": customer.get("address", "")},
           "items": order["items"], "old_gold": order.get("old_gold"),
           "total_price": order["total_price"], "old_gold_value": order.get("old_gold_value", 0),
           "net_payable": order["net_payable"], "advance_paid": order["advance_total"],
           "remaining_balance": order["remaining_balance"],
           "status": "active", "physical_bill_photo": body.physical_bill_photo,
           "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()}
    await db.invoices.insert_one(dict(doc))
    return doc


@api.get("/admin/invoices")
async def list_invoices(q: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {"is_deleted": False}
    if q:
        query["$or"] = [{"bill_number": {"$regex": q, "$options": "i"}},
                        {"customer.name": {"$regex": q, "$options": "i"}},
                        {"customer.phone": {"$regex": q}}]
    return await db.invoices.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.get("/admin/invoices/{iid}")
async def get_invoice(iid: str, admin=Depends(get_current_admin)):
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@api.patch("/admin/invoices/{iid}/status")
async def update_invoice_status(iid: str, body: StatusUpdate, admin=Depends(get_current_admin)):
    await db.invoices.update_one({"id": iid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    return clean(await db.invoices.find_one({"id": iid}))


@api.get("/verify/invoice/{iid}")
async def verify_invoice(iid: str):
    inv = await db.invoices.find_one({"$or": [{"id": iid}, {"bill_number": iid}], "is_deleted": False}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"shop_name": "Jai Supa Deurali Sun-Chandi Pasal", "bill_number": inv["bill_number"],
            "bill_number_np": to_nepali_digits(inv["bill_number"]),
            "invoice_date_ad": inv["invoice_date_ad"], "invoice_date_bs_np": inv["invoice_date_bs_np"],
            "customer_name_masked": mask_name(inv["customer"]["name"]),
            "total_amount": inv["net_payable"], "total_amount_np": to_nepali_digits(f"{inv['net_payable']:,.0f}"),
            "status": inv["status"]}


# ---------- Repairs ----------
@api.post("/admin/repairs")
async def create_repair(body: RepairBody, admin=Depends(get_current_admin)):
    customer = await db.customers.find_one({"id": body.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    seq = await next_seq("repair")
    bs = ad_to_bs(body.promised_date_ad) if body.promised_date_ad else {}
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "repair_number": f"REP-{seq:04d}",
                "customer_name": customer["name"], "customer_phone": customer["phone"],
                "promised_date_bs": bs.get("bs_date"), "promised_date_bs_np": bs.get("bs_date_np"),
                "paid_amount": 0.0, "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()})
    await db.repair_jobs.insert_one(dict(doc))
    return doc


@api.get("/admin/repairs")
async def list_repairs(status: Optional[str] = None, admin=Depends(get_current_admin)):
    query = {"is_deleted": False}
    if status:
        query["status"] = status
    return await db.repair_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.put("/admin/repairs/{rid}")
async def update_repair(rid: str, body: RepairBody, admin=Depends(get_current_admin)):
    bs = ad_to_bs(body.promised_date_ad) if body.promised_date_ad else {}
    doc = body.model_dump()
    doc.update({"promised_date_bs": bs.get("bs_date"), "promised_date_bs_np": bs.get("bs_date_np"), "updated_at": now_iso()})
    await db.repair_jobs.update_one({"id": rid}, {"$set": doc})
    return clean(await db.repair_jobs.find_one({"id": rid}))


# ---------- Certificates ----------
@api.post("/admin/certificates")
async def create_certificate(body: CertificateBody, admin=Depends(get_current_admin)):
    seq = await next_seq("certificate")
    bs = ad_to_bs(body.date_ad)
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "certificate_number": f"CERT-{date.today().year}-{seq:04d}",
                "date_bs": bs["bs_date"], "date_bs_np": bs["bs_date_np"],
                "weight_tola": grams_to_tola(body.weight_grams),
                "is_deleted": False, "created_at": now_iso(), "updated_at": now_iso()})
    await db.certificates.insert_one(dict(doc))
    return doc


@api.get("/admin/certificates")
async def list_certificates(admin=Depends(get_current_admin)):
    return await db.certificates.find({"is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/verify/certificate/{cid}")
async def verify_certificate(cid: str):
    cert = await db.certificates.find_one({"$or": [{"id": cid}, {"certificate_number": cid}], "is_deleted": False}, {"_id": 0})
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    product_code = None
    if cert.get("product_id"):
        p = await db.products.find_one({"id": cert["product_id"]}, {"_id": 0, "product_code": 1})
        product_code = p["product_code"] if p else None
    return {"shop_name": "Jai Supa Deurali Sun-Chandi Pasal", "certificate_number": cert["certificate_number"],
            "product_code": product_code, "metal": cert["metal"], "purity": cert["purity"],
            "weight_grams": cert["weight_grams"], "weight_tola": cert["weight_tola"],
            "stone_details": cert.get("stone_details", ""), "date_ad": cert["date_ad"],
            "date_bs_np": cert["date_bs_np"], "verified": True}


# ---------- Public Leads ----------
@api.post("/leads")
async def create_lead(body: LeadBody):
    doc = body.model_dump()
    doc.update({"id": str(uuid.uuid4()), "status": "new", "created_at": now_iso(), "updated_at": now_iso()})
    await db.public_leads.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


@api.get("/admin/leads")
async def list_leads(admin=Depends(get_current_admin)):
    return await db.public_leads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.patch("/admin/leads/{lid}/status")
async def update_lead_status(lid: str, body: StatusUpdate, admin=Depends(get_current_admin)):
    await db.public_leads.update_one({"id": lid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    return clean(await db.public_leads.find_one({"id": lid}))


# ---------- Public Order Status ----------
@api.get("/public/order-status")
async def public_order_status(phone: str):
    orders = await db.orders.find(
        {"customer_phone": phone.strip(), "is_deleted": False,
         "status": {"$nin": ["delivered", "cancelled"]}}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return [{"order_number": o["order_number"], "order_type": o["order_type"], "status": o["status"],
             "delivery_date_ad": o.get("delivery_date_ad"), "delivery_date_bs_np": o.get("delivery_date_bs_np"),
             "remaining_balance": o.get("remaining_balance", 0),
             "remaining_balance_np": to_nepali_digits(f"{o.get('remaining_balance', 0):,.0f}")} for o in orders]


# ---------- Dashboard, Search, Reports ----------
@api.get("/admin/dashboard")
async def dashboard(admin=Depends(get_current_admin)):
    today = today_str()
    week_end = (date.today() + timedelta(days=7)).isoformat()
    active = {"is_deleted": False, "status": {"$nin": ["delivered", "cancelled"]}}
    due_today = await db.orders.find({**active, "delivery_date_ad": today}, {"_id": 0}).to_list(100)
    due_week = await db.orders.find({**active, "delivery_date_ad": {"$gt": today, "$lte": week_end}}, {"_id": 0}).to_list(100)
    ready = await db.orders.find({"is_deleted": False, "status": "ready"}, {"_id": 0}).to_list(100)
    pending_pay = await db.orders.find({"is_deleted": False, "status": {"$ne": "cancelled"}, "remaining_balance": {"$gt": 0}}, {"_id": 0}).to_list(200)
    payments_today = await db.payments.find({"payment_date_ad": today}, {"_id": 0}).to_list(200)
    invoices_today = await db.invoices.count_documents({"invoice_date_ad": today, "is_deleted": False})
    pending_orders = await db.orders.count_documents(active)
    new_leads = await db.public_leads.count_documents({"status": "new"})
    return {"rate": await get_today_rate(), "orders_due_today": due_today, "orders_due_week": due_week,
            "ready_for_collection": ready, "pending_payments": pending_pay,
            "todays_sales": round(sum(p["amount"] for p in payments_today), 2),
            "todays_invoices": invoices_today, "pending_orders_count": pending_orders, "new_leads": new_leads}


@api.get("/admin/search")
async def global_search(q: str, admin=Depends(get_current_admin)):
    rx = {"$regex": q, "$options": "i"}
    customers = await db.customers.find({"is_deleted": False, "$or": [{"name": rx}, {"phone": {"$regex": q}}]}, {"_id": 0}).to_list(20)
    products = await db.products.find({"is_deleted": False, "$or": [{"name": rx}, {"product_code": rx}]}, {"_id": 0}).to_list(20)
    orders = await db.orders.find({"is_deleted": False, "$or": [{"order_number": rx}, {"customer_name": rx}, {"customer_phone": {"$regex": q}}]}, {"_id": 0}).to_list(20)
    invoices = await db.invoices.find({"is_deleted": False, "$or": [{"bill_number": rx}, {"customer.name": rx}]}, {"_id": 0}).to_list(20)
    return {"customers": customers, "products": products, "orders": orders, "invoices": invoices}


@api.get("/admin/reports")
async def reports(admin=Depends(get_current_admin)):
    today = today_str()
    week_end = (date.today() + timedelta(days=7)).isoformat()
    payments_today = await db.payments.find({"payment_date_ad": today}, {"_id": 0}).to_list(500)
    pending = await db.orders.find({"is_deleted": False, "status": {"$ne": "cancelled"}, "remaining_balance": {"$gt": 0}}, {"_id": 0}).to_list(500)
    return {"todays_sales": round(sum(p["amount"] for p in payments_today), 2),
            "orders_due_week": await db.orders.count_documents({"is_deleted": False, "status": {"$nin": ["delivered", "cancelled"]}, "delivery_date_ad": {"$gte": today, "$lte": week_end}}),
            "pending_payments_total": round(sum(o["remaining_balance"] for o in pending), 2),
            "pending_payments_count": len(pending),
            "available_stock": await db.products.count_documents({"is_deleted": False, "status": "available"}),
            "reserved_stock": await db.products.count_documents({"is_deleted": False, "status": "reserved"}),
            "sold_stock": await db.products.count_documents({"is_deleted": False, "status": "sold"})}


# ---------- Pricing calculator ----------
class CalcBody(BaseModel):
    weight_grams: Optional[float] = None
    tola: Optional[float] = None
    lal: Optional[float] = None
    aana: Optional[float] = None
    rate_per_tola: float
    purity: str = "24K"
    jarti_percent: float = 0
    jyala_amount: float = 0
    jyala_type: str = "flat"
    stone_cost: float = 0
    polishing_cost: float = 0
    cutting_cost: float = 0
    worker_charge: float = 0
    other_cost: float = 0
    discount: float = 0


@api.post("/admin/calculate-price")
async def calculate_price(body: CalcBody, admin=Depends(get_current_admin)):
    grams = body.weight_grams if body.weight_grams else tola_lal_aana_to_grams(body.tola or 0, body.lal or 0, body.aana or 0)
    return compute_price(grams, body.rate_per_tola, body.purity, body.jarti_percent,
                         body.jyala_amount, body.jyala_type, body.stone_cost, body.polishing_cost,
                         body.cutting_cost, body.worker_charge, body.other_cost, body.discount)


# ---------- Seed ----------
DEFAULT_CATEGORIES = ["Rings", "Necklaces", "Bangles", "Earrings", "Chains", "Bridal Sets", "Silver Items", "Coins", "Custom Orders", "Repair/Polish"]
DEFAULT_COLLECTIONS = ["Bridal Collection", "Daily Wear", "Festival Collection", "Dashain/Tihar Collection", "Wedding Set", "Silver Collection"]


@app.on_event("startup")
async def startup():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@jsdpasal.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email,
                                   "password_hash": hash_password(admin_password),
                                   "name": "Admin", "role": "admin", "created_at": now_iso()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    for name in DEFAULT_CATEGORIES:
        await db.categories.update_one({"name": name}, {"$setOnInsert": {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}}, upsert=True)
    for name in DEFAULT_COLLECTIONS:
        await db.collections.update_one({"name": name}, {"$setOnInsert": {"id": str(uuid.uuid4()), "name": name, "created_at": now_iso()}}, upsert=True)
    await db.customers.create_index("phone")
    await db.orders.create_index("customer_phone")
    await db.invoices.create_index("bill_number")
    await db.products.create_index("product_code")


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

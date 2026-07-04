"""
backend/models.py
Pydantic models that mirror the PostgreSQL rows defined in 0001_init.sql.

These are distinct from the request/response Pydantic models in server.py.
They represent the *stored* shape of each row and are used exclusively by
the repository layer.

Python 3.9 compatible — uses `from __future__ import annotations` and
Optional[X] instead of X | None.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Shared base
# ---------------------------------------------------------------------------
class _Base(BaseModel):
    class Config:
        # Allow reading from ORM-style attribute access (supabase returns dicts)
        orm_mode = True
        # Ignore extra keys that may appear in future schema changes
        extra = "ignore"


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------
class UserRow(_Base):
    id: str
    email: str
    password_hash: str
    name: str
    role: str
    created_at: datetime


# ---------------------------------------------------------------------------
# shop_settings  (singleton, id = 'shop')
# ---------------------------------------------------------------------------
class ShopSettingsRow(_Base):
    id: str
    shop_name: str
    shop_name_np: str
    tagline: str
    tagline_np: str
    phone: str
    whatsapp: str
    address: str
    maps_link: str
    opening_hours: str
    logo: str
    default_whatsapp_message: str
    updated_at: datetime


# ---------------------------------------------------------------------------
# categories
# ---------------------------------------------------------------------------
class CategoryRow(_Base):
    id: str
    name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# collections
# ---------------------------------------------------------------------------
class CollectionRow(_Base):
    id: str
    name: str
    created_at: datetime


# ---------------------------------------------------------------------------
# daily_rates
# ---------------------------------------------------------------------------
class DailyRateRow(_Base):
    id: str
    date_ad: date
    bs_date: Optional[str]
    bs_date_np: Optional[str]
    gold_24k: float
    gold_22k: float
    silver: float
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# customers
# ---------------------------------------------------------------------------
class CustomerRow(_Base):
    id: str
    name: str
    phone: str
    address: str
    notes: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# products
# ---------------------------------------------------------------------------
class ProductRow(_Base):
    id: str
    product_code: str
    name: str
    name_np: str
    description: str
    category: str
    collection: str
    metal: str
    purity: str
    weight_grams: float
    jarti_percent: float
    jyala_amount: float
    jyala_type: str
    stone_cost: float
    polishing_cost: float
    cutting_cost: float
    worker_charge: float
    other_cost: float
    status: str
    show_on_website: bool
    show_price_on_website: bool
    photos: List[Any]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# orders
# ---------------------------------------------------------------------------
class OrderRow(_Base):
    id: str
    order_number: str
    customer_id: str
    customer_name: str
    customer_phone: str
    order_type: str
    items: List[Dict[str, Any]]
    custom_description: str
    reference_photo: str
    order_date_ad: date
    order_date_bs: Optional[str]
    order_date_bs_np: Optional[str]
    delivery_date_ad: Optional[date]
    delivery_date_bs: Optional[str]
    delivery_date_bs_np: Optional[str]
    delivery_time: str
    status: str
    notes: str
    old_gold: Optional[Dict[str, Any]]
    total_price: float
    old_gold_value: float
    net_payable: float
    advance_total: float
    remaining_balance: float
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# payments
# ---------------------------------------------------------------------------
class PaymentRow(_Base):
    id: str
    order_id: str
    customer_id: str
    amount: float
    payment_date_ad: date
    payment_date_bs: Optional[str]
    payment_date_bs_np: Optional[str]
    method: str
    note: str
    created_at: datetime


# ---------------------------------------------------------------------------
# invoices
# ---------------------------------------------------------------------------
class InvoiceRow(_Base):
    id: str
    bill_number: str
    order_id: str
    order_number: str
    invoice_date_ad: date
    invoice_date_bs: Optional[str]
    invoice_date_bs_np: Optional[str]
    invoice_date_bs_long_np: Optional[str]
    customer_snapshot: Dict[str, Any]
    items: List[Dict[str, Any]]
    old_gold: Optional[Dict[str, Any]]
    total_price: float
    old_gold_value: float
    net_payable: float
    advance_paid: float
    remaining_balance: float
    status: str
    physical_bill_photo: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# repair_jobs
# ---------------------------------------------------------------------------
class RepairJobRow(_Base):
    id: str
    repair_number: str
    customer_id: str
    customer_name: str
    customer_phone: str
    service_type: str
    description: str
    intake_photo: str
    damage_photo: str
    after_photo: str
    promised_date_ad: Optional[date]
    promised_date_bs: Optional[str]
    promised_date_bs_np: Optional[str]
    charge: float
    paid_amount: float
    status: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# certificates
# ---------------------------------------------------------------------------
class CertificateRow(_Base):
    id: str
    certificate_number: str
    product_id: Optional[str]
    order_id: Optional[str]
    metal: str
    purity: str
    weight_grams: float
    weight_tola: float
    stone_details: str
    date_ad: date
    date_bs: Optional[str]
    date_bs_np: Optional[str]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# public_leads
# ---------------------------------------------------------------------------
class LeadRow(_Base):
    id: str
    lead_type: str
    name: str
    phone: str
    item_type: str
    metal: str
    service_type: str
    approx_weight: str
    budget: str
    deadline: str
    notes: str
    photo: str
    status: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# counters
# ---------------------------------------------------------------------------
class CounterRow(_Base):
    name: str
    seq: int

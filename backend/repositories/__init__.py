"""Repository layer for the Supabase Postgres backend.

Thin async data-access objects over SQLAlchemy models. Business helpers
(pricing, BS dates, payment status) are reused from utils / base — never
duplicated. Routes are wired in a later phase.
"""
from .base import BaseRepository, derive_payment_status
from .settings_repo import SettingsRepository
from .reference_repo import CategoriesRepository, CollectionsRepository
from .rates_repo import RatesRepository
from .products_repo import ProductsRepository
from .customers_repo import CustomersRepository
from .orders_repo import OrdersRepository
from .payments_repo import PaymentsRepository
from .expenses_repo import ExpensesRepository
from .repairs_repo import RepairsRepository
from .leads_repo import LeadsRepository
from .tasks_repo import AdminTasksRepository, MaterialTasksRepository
from .templates_repo import TemplatesRepository

__all__ = [
    "BaseRepository", "derive_payment_status",
    "SettingsRepository", "CategoriesRepository", "CollectionsRepository",
    "RatesRepository", "ProductsRepository", "CustomersRepository",
    "OrdersRepository", "PaymentsRepository", "ExpensesRepository", "RepairsRepository",
    "LeadsRepository", "AdminTasksRepository", "MaterialTasksRepository",
    "TemplatesRepository",
]

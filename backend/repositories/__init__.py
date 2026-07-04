"""
backend/repositories/__init__.py
Makes the repositories directory a Python package and re-exports
every repository class for convenient import.

Usage:
    from repositories import SettingsRepo, RatesRepo, ProductsRepo, ...
"""
from __future__ import annotations

from .settings_repo     import SettingsRepo
from .rates_repo        import RatesRepo
from .products_repo     import ProductsRepo
from .customers_repo    import CustomersRepo
from .orders_repo       import OrdersRepo
from .payments_repo     import PaymentsRepo
from .invoices_repo     import InvoicesRepo
from .repairs_repo      import RepairsRepo
from .certificates_repo import CertificatesRepo
from .leads_repo        import LeadsRepo

__all__ = [
    "SettingsRepo",
    "RatesRepo",
    "ProductsRepo",
    "CustomersRepo",
    "OrdersRepo",
    "PaymentsRepo",
    "InvoicesRepo",
    "RepairsRepo",
    "CertificatesRepo",
    "LeadsRepo",
]

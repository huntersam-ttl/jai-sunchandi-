"""Backend runtime configuration for the Supabase-backed FastAPI app.

Import-safe and dependency-free: reading this module never requires a
configured environment (values default to empty), so it can be imported and
unit-tested without secrets present. Actual secrets are supplied via backend/.env
at runtime (see backend/.env.example) and must never be committed.
"""
import os
import logging

logger = logging.getLogger(__name__)

# --- Runtime ---
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").strip().lower()
IS_PRODUCTION = ENVIRONMENT == "production"

# --- Supabase (all backend-only except SUPABASE_URL, which is also public) ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_DB_URL = os.environ.get("SUPABASE_DB_URL", "").strip()
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "").strip()

# --- Admin ---
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "").strip().lower()

# Backend settings that must be present for the app to run against Supabase.
REQUIRED_BACKEND_SETTINGS = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SUPABASE_JWT_SECRET",
)


def missing_backend_settings() -> list:
    """Names of required Supabase settings that are not set. Empty when ready."""
    values = {
        "SUPABASE_URL": SUPABASE_URL,
        "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_SERVICE_ROLE_KEY,
        "SUPABASE_DB_URL": SUPABASE_DB_URL,
        "SUPABASE_JWT_SECRET": SUPABASE_JWT_SECRET,
    }
    return [name for name, value in values.items() if not value]


def get_allowed_origins() -> list:
    """Resolve the CORS allowlist. Never returns ``"*"`` (unsafe with credentials).

    ``ALLOWED_ORIGINS`` (comma-separated) → dev localhost defaults. In production
    with nothing configured, returns an empty list (deny) and warns.
    """
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    if raw.strip():
        origins = [o.strip() for o in raw.split(",") if o.strip() and o.strip() != "*"]
        if origins:
            return origins
    if not IS_PRODUCTION:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    logger.critical(
        "ALLOWED_ORIGINS is not set in production; refusing all cross-origin requests."
    )
    return []


def async_database_url() -> str:
    """SUPABASE_DB_URL normalised to the SQLAlchemy asyncpg driver.

    Supabase provides a ``postgresql://`` connection string; SQLAlchemy's async
    engine needs the ``postgresql+asyncpg://`` scheme. Returns "" if unset.
    """
    url = SUPABASE_DB_URL
    if not url:
        return ""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return "postgresql+asyncpg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        return "postgresql+asyncpg://" + url[len("postgres://"):]
    return url

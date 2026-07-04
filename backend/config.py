"""
backend/config.py
Centralised settings loader for the Supabase data layer.

All values are read from environment variables (or a .env file loaded by
the FastAPI startup in server.py / via python-dotenv).

Python 3.9 compatible — uses `from __future__ import annotations`.
"""
from __future__ import annotations

import os


def _require(key: str) -> str:
    val = os.getenv(key, "").strip()
    if not val:
        raise RuntimeError(
            f"Missing required environment variable: {key}\n"
            "Copy backend/.env.example to backend/.env and fill in the values."
        )
    return val


class SupabaseSettings:
    """Read-once config object for the Supabase connection."""

    def __init__(self) -> None:
        self.url: str = _require("SUPABASE_URL")
        self.service_key: str = _require("SUPABASE_SERVICE_KEY")


# Module-level singleton — imported by db.py
supabase_settings = SupabaseSettings()

"""
backend/db.py
Supabase async client initialisation.

Exports a single `supabase` client instance that all repositories share.
The client uses the service-role key so it bypasses Row Level Security —
authorisation is enforced at the FastAPI / application layer.

Python 3.9 compatible.
"""
from __future__ import annotations

from supabase import create_client, Client

from config import supabase_settings

supabase: Client = create_client(
    supabase_settings.url,
    supabase_settings.service_key,
)

"""Minimal Supabase-backed FastAPI app (S3).

This is the new backend entrypoint for the Supabase stack. In S3 it exposes only
health checks and a protected whoami (to verify Supabase JWT auth end-to-end);
business routes are migrated in later phases. The legacy Mongo app (server.py)
is untouched and separate.
"""
import logging
from pathlib import Path

from dotenv import load_dotenv

# Load backend/.env before importing config (config reads os.environ at import).
load_dotenv(Path(__file__).parent / ".env")

from fastapi import Depends, FastAPI, HTTPException  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402

import config  # noqa: E402
import db
from supabase_auth import get_current_admin
from public_routes import router as public_router
from admin_routes import router as admin_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Jai Supa Deurali Sun-Chandi Pasal — Supabase API")


@app.get("/api/health")
async def health():
    """Liveness check (no DB)."""
    return {
        "status": "ok",
        "environment": config.ENVIRONMENT,
        "missing_settings": config.missing_backend_settings(),
    }


@app.get("/api/health/supabase")
async def health_supabase():
    """Verify the backend can reach Supabase Postgres via db.check_connection()."""
    try:
        ok = await db.check_connection()
    except Exception as exc:  # connection/config error
        logger.warning("Supabase DB health check failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database connection failed")
    return {"database": "ok" if ok else "unreachable"}


@app.get("/api/admin/whoami")
async def whoami(admin=Depends(get_current_admin)):
    """Protected: proves Supabase JWT verification + admin allowlist work."""
    return admin


# Public (unauthenticated) read/write routes for the website.
app.include_router(public_router)
# Authenticated admin routes (require a valid Supabase admin JWT).
app.include_router(admin_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=config.get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown():
    await db.dispose_engine()

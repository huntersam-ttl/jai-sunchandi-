"""Supabase Auth JWT verification for protected admin routes.

The frontend logs in via supabase-js and sends the Supabase access token as
``Authorization: Bearer <token>``. This module verifies that token against the
project's JWT secret (HS256) and enforces the single-admin allowlist
(``ADMIN_EMAIL``). It is independent of the legacy Mongo auth (auth.py), which
is left untouched during the migration.
"""
from __future__ import annotations

import jwt
import logging
from fastapi import HTTPException, Request

import config

# Supabase access tokens are issued with this audience.
SUPABASE_AUDIENCE = "authenticated"
logger = logging.getLogger(__name__)


def _bearer_token(request: Request):
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def verify_supabase_jwt(token: str) -> dict:
    """Decode and verify a Supabase access token (HS256). Returns the claims."""
    if not config.SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="Supabase JWT secret not configured")
    try:
        return jwt.decode(
            token,
            config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=SUPABASE_AUDIENCE,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        logger.warning("Supabase JWT validation failed: %s", exc.__class__.__name__)
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(request: Request) -> dict:
    """FastAPI dependency: require a valid Supabase token for the allowlisted admin."""
    token = _bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    claims = verify_supabase_jwt(token)
    email = (claims.get("email") or "").strip().lower()
    if not config.ADMIN_EMAIL:
        raise HTTPException(status_code=500, detail="ADMIN_EMAIL not configured")
    if email != config.ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Not authorized")
    return {"id": claims.get("sub"), "email": email, "role": claims.get("role")}

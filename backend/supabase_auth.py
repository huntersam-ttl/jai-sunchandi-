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


def _log_unverified_header(token: str) -> None:
    # Safe diagnostic only: the unverified header (alg/typ) never requires the
    # secret and never exposes the token or its signature. This is the fastest
    # way to tell a wrong/mismatched SUPABASE_JWT_SECRET apart from Supabase
    # having moved to an asymmetric signing key (a static HS256 secret can
    # never verify those, no matter how many times it's re-copied).
    try:
        header = jwt.get_unverified_header(token)
        logger.warning("Supabase JWT header (unverified): alg=%s typ=%s",
                       header.get("alg"), header.get("typ"))
    except Exception as exc:
        logger.warning("Supabase JWT header could not be parsed: %s", exc.__class__.__name__)


def verify_supabase_jwt(token: str) -> dict:
    """Decode and verify a Supabase access token (HS256). Returns the claims."""
    logger.info("Supabase JWT verify: token_length=%d secret_configured=%s",
               len(token), bool(config.SUPABASE_JWT_SECRET))
    if not config.SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="Supabase JWT secret not configured")
    try:
        claims = jwt.decode(
            token,
            config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience=SUPABASE_AUDIENCE,
        )
        logger.info("Supabase JWT verify: ok, claim_keys=%s", sorted(claims.keys()))
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        logger.warning("Supabase JWT validation failed: %s", exc.__class__.__name__)
        _log_unverified_header(token)
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(request: Request) -> dict:
    """FastAPI dependency: require a valid Supabase token for the allowlisted admin."""
    token = _bearer_token(request)
    if not token:
        logger.info("Admin auth: no Authorization bearer token present")
        raise HTTPException(status_code=401, detail="Not authenticated")
    claims = verify_supabase_jwt(token)
    email = (claims.get("email") or "").strip().lower()
    if not config.ADMIN_EMAIL:
        raise HTTPException(status_code=500, detail="ADMIN_EMAIL not configured")
    if email != config.ADMIN_EMAIL:
        logger.warning("Admin auth: email mismatch (token email present=%s)", bool(email))
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"id": claims.get("sub"), "email": email, "role": claims.get("role")}

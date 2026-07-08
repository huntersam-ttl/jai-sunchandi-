"""Supabase Auth JWT verification for protected admin routes.

The frontend logs in via supabase-js and sends the Supabase access token as
``Authorization: Bearer <token>``. This project's Supabase tokens are signed
with an asymmetric key (confirmed live: ES256) -- a static HS256 secret can
never verify those, no matter how many times it's re-copied. Verification
therefore uses Supabase's JWKS endpoint (the project's public signing keys),
not a shared secret. It also enforces the single-admin allowlist
(``ADMIN_EMAIL``). It is independent of the legacy Mongo auth (auth.py),
which is left untouched during the migration.
"""
from __future__ import annotations

import logging

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

import config

# Supabase access tokens are issued with this audience.
SUPABASE_AUDIENCE = "authenticated"
# Supabase currently signs with ES256; RS256 is accepted too since JWKS keys
# are matched by kid/alg regardless -- both are asymmetric, never a static
# shared secret.
SUPABASE_JWT_ALGORITHMS = ["ES256", "RS256"]
logger = logging.getLogger(__name__)

_jwks_client: PyJWKClient | None = None


def _jwks_url() -> str:
    base = config.SUPABASE_URL.rstrip("/")
    return f"{base}/auth/v1/.well-known/jwks.json"


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        # Cached client: PyJWKClient caches fetched keys in-process and only
        # re-fetches the JWKS document when a kid it hasn't seen appears
        # (e.g. after Supabase rotates signing keys).
        _jwks_client = PyJWKClient(_jwks_url(), cache_keys=True, lifespan=3600)
    return _jwks_client


def _bearer_token(request: Request):
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return None


def _log_unverified_header(token: str) -> None:
    # Safe diagnostic only: the unverified header (alg/kid/typ) never
    # requires a key and never exposes the token, its signature, or any
    # secret/key material.
    try:
        header = jwt.get_unverified_header(token)
        logger.warning("Supabase JWT header (unverified): alg=%s typ=%s kid=%s",
                       header.get("alg"), header.get("typ"), header.get("kid"))
    except Exception as exc:
        logger.warning("Supabase JWT header could not be parsed: %s", exc.__class__.__name__)


def verify_supabase_jwt(token: str) -> dict:
    """Decode and verify a Supabase access token via JWKS. Returns the claims."""
    logger.info("Supabase JWT verify: token_length=%d supabase_url_configured=%s",
               len(token), bool(config.SUPABASE_URL))
    if not config.SUPABASE_URL:
        raise HTTPException(status_code=500, detail="Supabase URL not configured")
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=SUPABASE_JWT_ALGORITHMS,
            audience=SUPABASE_AUDIENCE,
        )
        logger.info("Supabase JWT verify: ok, claim_keys=%s", sorted(claims.keys()))
        return claims
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as exc:
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

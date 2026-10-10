"""Database-backed throttling for unauthenticated public endpoints.

Vercel functions are distributed and short-lived, so process-local counters are
not a reliable control. The limiter stores only an HMAC of the client address
and endpoint bucket in PostgreSQL; it never logs or persists the raw address.
"""
from __future__ import annotations

import hashlib
import hmac

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

import config


def _client_address(request: Request) -> str:
    forwarded = (
        request.headers.get("x-vercel-forwarded-for")
        or request.headers.get("x-forwarded-for")
        or request.headers.get("x-real-ip")
    )
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def _key_hash(request: Request, bucket: str) -> str:
    secret = config.SUPABASE_SERVICE_ROLE_KEY or config.SUPABASE_URL or "development-rate-limit-key"
    material = f"{bucket}:{_client_address(request)}".encode()
    return hmac.new(secret.encode(), material, hashlib.sha256).hexdigest()


async def enforce_public_rate_limit(
    request: Request,
    session: AsyncSession,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
) -> None:
    result = await session.execute(
        text(
            """
            insert into public.public_request_limits (key_hash, window_started_at, request_count, updated_at)
            values (:key_hash, now(), 1, now())
            on conflict (key_hash) do update set
              request_count = case
                when extract(epoch from (now() - public_request_limits.window_started_at)) >= :window_seconds
                  then 1
                else public.public_request_limits.request_count + 1
              end,
              window_started_at = case
                when extract(epoch from (now() - public_request_limits.window_started_at)) >= :window_seconds
                  then now()
                else public.public_request_limits.window_started_at
              end,
              updated_at = now()
            returning request_count
            """
        ),
        {"key_hash": _key_hash(request, bucket), "window_seconds": window_seconds},
    )
    count = result.scalar_one()
    await session.commit()
    if count > limit:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please wait a moment and try again.",
            headers={"Retry-After": str(window_seconds)},
        )

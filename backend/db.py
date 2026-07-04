"""Async SQLAlchemy database layer for the Supabase Postgres backend.

The engine and session factory are created lazily so this module can be imported
without a configured database (e.g. in unit tests). The backend connects with
the Supabase service-role Postgres URL (`SUPABASE_DB_URL`); it bypasses RLS and
is the sole mediator of business data. Never expose this connection to clients.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine,
)

import config

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker | None = None


def get_engine() -> AsyncEngine:
    """Return the process-wide async engine, creating it on first use."""
    global _engine
    if _engine is None:
        url = config.async_database_url()
        if not url:
            raise RuntimeError(
                "SUPABASE_DB_URL is not configured; cannot create the database engine."
            )
        _engine = create_async_engine(
            url,
            pool_pre_ping=True,   # transparently recycle dropped pooled connections
            pool_size=5,
            max_overflow=5,
            echo=False,
        )
        logger.info("Async database engine created (%s).", config.ENVIRONMENT)
    return _engine


def get_sessionmaker() -> async_sessionmaker:
    """Return the process-wide async session factory, creating it on first use."""
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(), expire_on_commit=False, class_=AsyncSession
        )
    return _sessionmaker


@asynccontextmanager
async def session_scope():
    """Async context manager yielding a session with commit/rollback handling."""
    session = get_sessionmaker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_session() -> AsyncSession:
    """FastAPI dependency: yield a request-scoped session (used from S3 onwards)."""
    async with get_sessionmaker()() as session:
        yield session


async def check_connection() -> bool:
    """Health check: run `select 1`. Returns True on success, raises otherwise."""
    async with get_sessionmaker()() as session:
        result = await session.execute(text("select 1"))
        return result.scalar() == 1


async def dispose_engine() -> None:
    """Dispose the engine on shutdown (idempotent)."""
    global _engine, _sessionmaker
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _sessionmaker = None

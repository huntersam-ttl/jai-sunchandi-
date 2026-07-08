"""Async SQLAlchemy database layer for the Supabase Postgres backend.

The engine and session factory are created lazily so this module can be imported
without a configured database (e.g. in unit tests). The backend connects with
the Supabase service-role Postgres URL (`SUPABASE_DB_URL`); it bypasses RLS and
is the sole mediator of business data. Never expose this connection to clients.

Serverless connection pooling
------------------------------
Each Vercel serverless invocation may cold-start a brand-new process (a fresh
``_engine``/pool), while Supabase's own pooler (Supavisor) sits in front of
Postgres with its own small, shared client limit. A traditional SQLAlchemy
QueuePool (the default) holds a handful of *idle* connections open per
process; when a serverless container freezes or is recycled those don't
always get released cleanly on the pooler side, and enough cold starts can
exhaust Supavisor's session-mode pool (seen in production as
``EMAXCONNSESSION: max clients reached in session mode``).

NullPool avoids this at the source: it never holds an idle connection
between requests -- each checkout opens a connection, the request uses it,
and it's closed and handed back immediately after. That's the right shape
for "one process handles ~one request at a time, then may disappear
entirely," which is what serverless actually is; a resident connection pool
mostly just becomes stranded state. ``statement_cache_size=0`` is required
whenever the DB URL points at a transaction-mode pooler (asyncpg's prepared
statement cache doesn't work across a pgbouncer/Supavisor transaction-mode
connection that gets handed to a different backend each time) and is a
harmless no-op against session mode or a direct connection, so it's set
unconditionally rather than trying to detect and branch on pooler mode.
"""
from __future__ import annotations

import logging
import re
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine,
)
from sqlalchemy.pool import NullPool

import config

logger = logging.getLogger(__name__)

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker | None = None

_PORT_RE = re.compile(r":(\d{2,5})/")


def _describe_pooler_port(url: str) -> str:
    """Best-effort, secret-free description of which pooler port is in use
    (for logging only -- never logs host, user, or password)."""
    match = _PORT_RE.search(url)
    if not match:
        return "unknown"
    port = match.group(1)
    if port == "6543":
        return "6543 (transaction-mode pooler)"
    if port == "5432":
        return "5432 (session-mode pooler or direct connection)"
    return f"{port} (non-standard)"


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
            poolclass=NullPool,  # serverless-safe: never holds an idle connection
            connect_args={"statement_cache_size": 0},  # required for transaction-mode poolers
            echo=False,
        )
        logger.info(
            "Async database engine created (%s): pool=NullPool statement_cache_size=0 port=%s",
            config.ENVIRONMENT, _describe_pooler_port(url),
        )
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

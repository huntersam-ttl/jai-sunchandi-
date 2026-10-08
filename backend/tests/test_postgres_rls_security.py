"""Role-based checks for the post-0018 Supabase authorization boundary.

These tests run only against the disposable PostgreSQL service in CI.  They
use the real database roles (anon/authenticated), JWT-claim session settings,
RLS, and grants; they never connect to the hosted Supabase project.
"""

from __future__ import annotations

import os
import asyncio
import uuid

import asyncpg
import pytest


TEST_URL = os.getenv("TEST_POSTGRES_URL", "")
if not TEST_URL:
    pytest.skip("TEST_POSTGRES_URL is not configured", allow_module_level=True)
if TEST_URL.startswith("postgresql+asyncpg://"):
    TEST_URL = "postgresql://" + TEST_URL[len("postgresql+asyncpg://") :]
if "supabase" in TEST_URL.lower() or "pooler.supabase.com" in TEST_URL.lower():
    pytest.fail("test_postgres_rls_security.py must use disposable PostgreSQL")


ADMIN_ID = uuid.uuid4()
ORDINARY_ID = uuid.uuid4()


async def _connection() -> asyncpg.Connection:
    return await asyncpg.connect(TEST_URL)


async def _as_role(role: str, user_id: uuid.UUID | None = None):
    conn = await _connection()
    tx = conn.transaction()
    await tx.start()
    await conn.execute(f"set local role {role}")
    if user_id is not None:
        await conn.execute(
            "select set_config('request.jwt.claim.sub', $1, true)", str(user_id)
        )
    return conn, tx


async def _setup_synthetic_admin():
    conn = await _connection()
    await conn.execute("insert into auth.users (id) values ($1)", ADMIN_ID)
    await conn.execute("insert into auth.users (id) values ($1)", ORDINARY_ID)
    await conn.execute(
        "insert into public.shop_admins (user_id) values ($1)", ADMIN_ID
    )
    await conn.close()


async def _cleanup_synthetic_admin():
    conn = await _connection()
    await conn.execute("delete from storage.objects where name like 'ci-rls/%'")
    await conn.execute(
        "delete from public.shop_admins where user_id in ($1, $2)",
        ADMIN_ID,
        ORDINARY_ID,
    )
    await conn.execute(
        "delete from auth.users where id in ($1, $2)", ADMIN_ID, ORDINARY_ID
    )
    await conn.close()


@pytest.fixture(scope="module", autouse=True)
def synthetic_admin():
    asyncio.run(_setup_synthetic_admin())
    yield
    asyncio.run(_cleanup_synthetic_admin())


def test_anonymous_catalogue_read_and_private_table_denial():
    async def run():
        conn, tx = await _as_role("anon")
        try:
            assert await conn.fetchval("select count(*) from public.public_products") == 0
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.fetchval("select count(*) from public.customers")
        finally:
            await tx.rollback()
            await conn.close()

    asyncio.run(run())


def test_ordinary_authenticated_user_is_not_an_admin():
    async def run():
        conn, tx = await _as_role("authenticated", ORDINARY_ID)
        try:
            assert await conn.fetchval("select count(*) from public.customers") == 0
            assert await conn.fetchval("select count(*) from public.shop_admins") == 0
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.execute("truncate public.customers")
            with pytest.raises(asyncpg.exceptions.InsufficientPrivilegeError):
                await conn.execute(
                    "insert into public.shop_admins (user_id) values ($1)", ORDINARY_ID
                )
        finally:
            await tx.rollback()
            await conn.close()

    asyncio.run(run())


def test_enrolled_admin_can_read_membership_and_storage():
    async def run():
        conn, tx = await _as_role("authenticated", ADMIN_ID)
        try:
            assert await conn.fetchval("select count(*) from public.shop_admins") == 1
            await conn.execute(
                "insert into storage.objects (bucket_id, name) values ('shop', $1)",
                f"ci-rls/{uuid.uuid4()}.png",
            )
        finally:
            await tx.rollback()
            await conn.close()

    asyncio.run(run())


def test_old_bypass_policies_and_dangerous_grants_are_gone():
    async def run():
        conn = await _connection()
        try:
            bypass_count = await conn.fetchval(
                """
                select count(*)
                from pg_policies
                where schemaname = 'public'
                  and policyname like 'service role only%'
                """
            )
            assert bypass_count == 0

            rows = await conn.fetch(
                """
                select grantee, privilege_type
                from information_schema.role_table_grants
                where grantee in ('anon', 'authenticated')
                  and table_schema in ('public', 'storage')
                  and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER')
                """
            )
            assert rows == []
        finally:
            await conn.close()

    asyncio.run(run())

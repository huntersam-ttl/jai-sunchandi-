from pathlib import Path

from starlette.requests import Request

from public_rate_limit import _client_address, _key_hash


ROOT = Path(__file__).resolve().parents[2]


def request_for(headers=None, client_host="127.0.0.1"):
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/api/public/order-status",
        "headers": [(key.lower().encode(), value.encode()) for key, value in (headers or {}).items()],
        "client": (client_host, 1234),
        "scheme": "http",
        "server": ("testserver", 80),
        "query_string": b"",
    }
    return Request(scope)


def test_rate_limit_key_is_hmac_and_bucket_scoped():
    request = request_for({"x-vercel-forwarded-for": "203.0.113.10"})
    assert _client_address(request) == "203.0.113.10"
    assert _key_hash(request, "lead") != "203.0.113.10"
    assert _key_hash(request, "lead") != _key_hash(request, "order-status")


def test_rate_limit_migration_is_private_and_server_side():
    migration = (ROOT / "supabase/migrations/0017_public_request_limits.sql").read_text()
    assert "enable row level security" in migration
    assert "revoke all on public.public_request_limits from anon, authenticated" in migration

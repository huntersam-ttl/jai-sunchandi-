"""Read-only staging preflight for the Supabase-backed deployment.

This tool deliberately does not create products, orders, payments, users, or
Storage objects. It only targets localhost or a Vercel preview URL and checks
public/liveness endpoints with synthetic lookup values. Any rate-limit probe
must be explicitly enabled because it increments staging counters.
"""
from __future__ import annotations

import argparse
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen


PRODUCTION_HOSTS = {"jaisupadeurali.com", "www.jaisupadeurali.com"}
SYNTHETIC_CONFIRMATION = "I_UNDERSTAND_SYNTHETIC_STAGING"


def _validate_staging_url(raw: str) -> str:
    value = raw.strip().rstrip("/")
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    allowed_preview = host.endswith(".vercel.app")
    allowed_local = host in {"localhost", "127.0.0.1", "::1"}
    allowed_explicit = host == os.environ.get("STAGING_ALLOWED_HOST", "").lower().strip()
    if parsed.scheme not in {"http", "https"} or not host:
        raise ValueError("STAGING_BASE_URL must be an http(s) URL with a host")
    if parsed.username or parsed.password:
        raise ValueError("STAGING_BASE_URL must not contain embedded credentials")
    if host in PRODUCTION_HOSTS or host.endswith(".supabase.co"):
        raise ValueError("Refusing to target a production/custom Supabase host")
    if not (allowed_preview or allowed_local or allowed_explicit):
        raise ValueError("Host is not an approved localhost/Vercel preview staging target")
    return value


def _get(base_url: str, path: str, expected: set[int]) -> tuple[bool, int]:
    request = Request(f"{base_url}{path}", headers={"Accept": "application/json"})
    try:
        with urlopen(request, timeout=15) as response:  # noqa: S310 - URL is guarded above.
            status = response.status
            response.read(256)
    except HTTPError as error:
        status = error.code
    except (URLError, TimeoutError) as error:
        print(f"FAIL {path}: {type(error).__name__}")
        return False, 0
    ok = status in expected
    print(f"{'PASS' if ok else 'FAIL'} {path}: HTTP {status}")
    return ok, status


def run(rate_limit_probe: bool = False) -> int:
    try:
        base_url = _validate_staging_url(os.environ["STAGING_BASE_URL"])
    except (KeyError, ValueError) as error:
        print(f"STAGING TARGET ERROR: {error}", file=sys.stderr)
        return 2

    checks = [
        ("/api/health", {200}),
        ("/api/health/supabase", {200}),
        ("/api/rates/today", {200}),
        ("/api/categories", {200}),
        ("/api/collections", {200}),
        ("/api/products", {200}),
        ("/api/settings", {200}),
        (f"/api/public/order-status?{urlencode({'order_number': 'STAGING-NOT-REAL', 'phone': '0000000000'})}", {404}),
    ]
    results = [_get(base_url, path, expected)[0] for path, expected in checks]

    if rate_limit_probe:
        if os.environ.get("STAGING_CONFIRMATION") != SYNTHETIC_CONFIRMATION:
            print("RATE LIMIT ERROR: set STAGING_CONFIRMATION explicitly", file=sys.stderr)
            return 2
        statuses = []
        path = f"/api/public/order-status?{urlencode({'order_number': 'STAGING-RATE-LIMIT', 'phone': '0000000000'})}"
        for _ in range(21):
            _, status = _get(base_url, path, {404, 429})
            statuses.append(status)
        results.append(statuses[-1] == 429 and statuses[:-1].count(429) == 0)
        print(f"{'PASS' if results[-1] else 'FAIL'} synthetic order-status limit: 429 after 20 requests")

    return 0 if all(results) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--rate-limit-probe",
        action="store_true",
        help="Run 21 synthetic order-status lookups; requires explicit staging confirmation.",
    )
    args = parser.parse_args()
    return run(rate_limit_probe=args.rate_limit_probe)


if __name__ == "__main__":
    raise SystemExit(main())

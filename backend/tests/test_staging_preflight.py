import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from tools.staging_preflight import _validate_staging_url  # noqa: E402


def test_staging_preflight_allows_local_and_vercel_preview():
    assert _validate_staging_url("http://127.0.0.1:8000") == "http://127.0.0.1:8000"
    assert _validate_staging_url("https://jai-preview.vercel.app/") == "https://jai-preview.vercel.app"


def test_staging_preflight_rejects_production_and_supabase_hosts(monkeypatch):
    monkeypatch.delenv("STAGING_ALLOWED_HOST", raising=False)
    for url in ("https://www.jaisupadeurali.com", "https://db.example.supabase.co"):
        try:
            _validate_staging_url(url)
        except ValueError:
            pass
        else:
            raise AssertionError(f"unsafe staging URL accepted: {url}")


def test_staging_preflight_requires_explicit_host_for_custom_preview(monkeypatch):
    monkeypatch.setenv("STAGING_ALLOWED_HOST", "staging.example.test")
    assert _validate_staging_url("https://staging.example.test") == "https://staging.example.test"

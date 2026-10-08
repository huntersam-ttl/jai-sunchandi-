"""Static deployment checks that do not require hosted credentials."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_vercel_function_and_spa_routes_are_declared():
    config = json.loads((ROOT / "vercel.json").read_text())
    assert (ROOT / "api" / "index.py").exists()
    assert config["outputDirectory"] == "frontend/build"
    assert any(rule["source"] == "/api/(.*)" for rule in config["rewrites"])
    assert any(rule["destination"] == "/index.html" for rule in config["rewrites"])


def test_vercel_python_dependencies_are_discoverable_at_project_root():
    requirements = (ROOT / "requirements.txt").read_text()
    assert "fastapi==" in requirements
    assert "asyncpg==" in requirements
    assert "SQLAlchemy==" in requirements
    assert "pytest==" not in requirements


def test_frontend_environment_example_contains_no_backend_secrets():
    lines = (ROOT / "frontend" / ".env.example").read_text().splitlines()
    assigned = {
        line.split("=", 1)[0].strip()
        for line in lines
        if "=" in line and not line.strip().startswith("#")
    }
    assert "SUPABASE_SERVICE_ROLE_KEY" not in assigned
    assert "SUPABASE_DB_URL" not in assigned
    assert "REACT_APP_SUPABASE_ANON_KEY" in assigned


def test_production_seo_build_fails_without_site_url():
    seo_script = (ROOT / "frontend" / "scripts" / "generate-seo.js").read_text()
    assert "REACT_APP_SITE_URL is required for a production build" in seo_script

"""Vercel Python function entrypoint.

Re-exports the Supabase FastAPI app (backend/app.py) so Vercel's Python
runtime can serve it. Vercel only puts this file's own directory on
sys.path, so backend/ (bundled alongside via vercel.json's
functions.includeFiles) is added explicitly, mirroring the same pattern
already used in backend/tests/test_data_layer.py.
"""
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app import app  # noqa: E402

__all__ = ["app"]

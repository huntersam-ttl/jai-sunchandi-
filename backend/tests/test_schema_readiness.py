from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from schema_readiness import REQUIRED_COLUMNS, missing_schema_columns

def test_complete_schema_is_ready():
    actual = [(table, field) for table, fields in REQUIRED_COLUMNS.items() for field in fields]
    assert missing_schema_columns(actual) == []

def test_missing_tables_and_columns_are_reported():
    actual = [("leads", "voice_note_path"), ("orders", "fulfilment_method")]
    missing = missing_schema_columns(actual)
    assert "shop_admins.user_id" in missing
    assert "public_request_limits.key_hash" in missing
    assert "leads.voice_note_path" not in missing
    assert "orders.fulfilment_country" in missing

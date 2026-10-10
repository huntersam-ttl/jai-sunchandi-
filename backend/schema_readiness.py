"""Read-only schema readiness for the Supabase-backed admin application.

Unlike a migration, this only inspects information_schema and never changes
shop records. Do not return DB connection credentials or SQL exceptions.
"""
from sqlalchemy import text

REQUIRED_COLUMNS = {
    "leads": ("voice_note_path", "photo_urls", "purity", "size", "country",
              "fulfilment_method", "collector_name", "collector_phone",
              "collector_relationship"),
    "orders": ("fulfilment_method", "collector_name", "collector_phone",
               "collector_relationship", "fulfilment_country", "collected_at",
               "pickup_pin_hash", "pickup_pin_issued_at", "collected_by_name"),
    "shop_admins": ("user_id",),
    "public_request_limits": ("key_hash", "request_count", "window_started_at"),
}

def missing_schema_columns(rows):
    available = {(str(table), str(column)) for table, column in rows}
    return [f"{table}.{column}" for table, columns in REQUIRED_COLUMNS.items()
            for column in columns if (table, column) not in available]

async def inspect_schema(session):
    results = await session.execute(text(
        "select table_name, column_name from information_schema.columns "
        "where table_schema = 'public' and table_name in "
        "('leads','orders','shop_admins','public_request_limits')"
    ))
    missing = missing_schema_columns(results.all())
    # Presence of private voice storage is a separate hosted-Supabase requirement.
    # Supabase Storage schema exists in the hosted database, not disposable CI.
    if not missing:
        buckets = await session.execute(text(
            "select count(*) from storage.buckets "
            "where id = 'voice-notes' and public = false"
        ))
        if buckets.scalar_one() == 0:
            missing.append("storage.voice-notes (private bucket)")
    return {"ready": not missing, "missing": missing,
            "message": "Admin database schema is ready" if not missing
            else "Database upgrade required; some shop features are unavailable"}

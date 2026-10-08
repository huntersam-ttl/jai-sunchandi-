"""Shared fulfilment and collection validation for public and admin routes."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets

FULFILMENT_METHODS = frozenset({
    "self_collect", "authorised_collector", "local_delivery",
    "traveller_collect", "international_shipping",
})
COLLECTOR_METHODS = frozenset({"authorised_collector", "traveller_collect"})
PICKUP_METHODS = frozenset({"self_collect", "authorised_collector", "traveller_collect"})
COUNTRY_CODE_RE = re.compile(r"^[A-Z]{2}$")
PHONE_RE = re.compile(r"^[0-9+() .-]{7,24}$")
PHOTO_PATH_RE = re.compile(r"^leads/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:jpg|jpeg|png|webp)$", re.IGNORECASE)


def validate_country(country: str) -> str:
    value = (country or "NP").strip().upper()
    if not COUNTRY_CODE_RE.fullmatch(value):
        raise ValueError("country must be a two-letter ISO country code")
    return value


def validate_phone(phone: str) -> str:
    value = (phone or "").strip()
    if not PHONE_RE.fullmatch(value) or sum(ch.isdigit() for ch in value) < 7:
        raise ValueError("collector phone number is invalid")
    return value


def validate_fulfilment(
    method: str, collector_name: str = "", collector_phone: str = "", country: str = "NP",
    collector_relationship: str = "",
) -> dict:
    method = (method or "self_collect").strip()
    if method not in FULFILMENT_METHODS:
        raise ValueError("invalid fulfilment method")
    country = validate_country(country)
    name = (collector_name or "").strip()
    phone = (collector_phone or "").strip()
    relationship = (collector_relationship or "").strip()
    if method in COLLECTOR_METHODS:
        if not name:
            raise ValueError("collector full name is required for this fulfilment method")
        validate_phone(phone)
    elif name or phone or relationship:
        raise ValueError("collector details are only valid for an authorised collector")
    return {
        "fulfilment_method": method, "collector_name": name, "collector_phone": phone,
        "collector_relationship": relationship, "country": country,
    }


def issue_pickup_pin() -> tuple[str, str]:
    pin = f"{secrets.randbelow(1_000_000):06d}"
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(pin.encode(), salt=salt, n=2**14, r=8, p=1)
    return pin, f"{salt.hex()}${digest.hex()}"


def verify_pickup_pin(pin: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", 1)
        candidate = hashlib.scrypt(str(pin).encode(), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(candidate.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def validate_photo_paths(paths: list[str]) -> list[str]:
    if len(paths) > 5:
        raise ValueError("up to five reference photos are allowed")
    if any(not PHOTO_PATH_RE.fullmatch(path or "") or ".." in path for path in paths):
        raise ValueError("invalid reference photo path")
    return paths

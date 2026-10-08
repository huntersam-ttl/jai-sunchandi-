import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from fulfilment import (  # noqa: E402
    FULFILMENT_METHODS,
    validate_country,
    validate_fulfilment,
    validate_photo_paths,
    issue_pickup_pin,
    verify_pickup_pin,
)


@pytest.mark.parametrize("method", sorted(FULFILMENT_METHODS))
def test_canonical_fulfilment_values_are_accepted(method):
    kwargs = (
        {"collector_name": "Mina Rai", "collector_phone": "9812345678"}
        if method in {"authorised_collector", "traveller_collect"} else {}
    )
    assert validate_fulfilment(method, country="NP", **kwargs)["fulfilment_method"] == method


def test_unknown_fulfilment_is_rejected():
    with pytest.raises(ValueError, match="invalid fulfilment"):
        validate_fulfilment("pickup_by_friend")


@pytest.mark.parametrize("name,phone", [("", "9812345678"), ("Mina Rai", "")])
def test_authorised_collector_requires_name_and_phone(name, phone):
    with pytest.raises(ValueError):
        validate_fulfilment("authorised_collector", name, phone)


def test_self_collection_does_not_accept_collector_details():
    with pytest.raises(ValueError):
        validate_fulfilment("self_collect", "Mina Rai", "9812345678")


@pytest.mark.parametrize("country", ["NP", "GB", "AU"])
def test_supported_country_codes(country):
    assert validate_country(country) == country


def test_malformed_country_code_is_rejected():
    with pytest.raises(ValueError, match="country"):
        validate_country("United Kingdom")


def test_pickup_pin_is_random_and_only_verifies_against_its_hash():
    pin_a, hash_a = issue_pickup_pin()
    pin_b, hash_b = issue_pickup_pin()
    assert pin_a != pin_b or hash_a != hash_b
    assert verify_pickup_pin(pin_a, hash_a)
    assert not verify_pickup_pin("000000", hash_a)
    assert not verify_pickup_pin(pin_a, hash_b)


def test_reference_photo_paths_are_capped_and_restricted():
    paths = [f"leads/{i}.webp" for i in range(5)]
    assert validate_photo_paths(paths) == paths
    with pytest.raises(ValueError, match="five"):
        validate_photo_paths(paths + ["leads/6.webp"])
    with pytest.raises(ValueError, match="path"):
        validate_photo_paths(["leads/unsafe.svg"])
    with pytest.raises(ValueError, match="path"):
        validate_photo_paths(["leads/../other.webp"])


def test_storage_layer_keeps_enquiry_uploads_private_and_bounded():
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase" / "migrations" / "0004_public_upload_policies.sql"
    ).read_text()
    assert "file_size_limit = 5242880" in migration
    assert "image/jpeg" in migration and "image/png" in migration and "image/webp" in migration
    assert "public_read_public_buckets" not in migration


def test_secure_workflow_migration_is_additive_and_canonical():
    migration = (
        Path(__file__).resolve().parents[2]
        / "supabase" / "migrations" / "0016_secure_fulfilment_workflow.sql"
    ).read_text()
    assert "add column if not exists pickup_pin_hash" in migration
    assert "add column if not exists collected_by_name" in migration
    assert "'collected'" in migration
    for value in ("self_collect", "authorised_collector", "local_delivery", "traveller_collect"):
        assert value in migration

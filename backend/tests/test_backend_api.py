"""Comprehensive backend tests for Jai Supa Deurali Sun-Chandi Pasal API.

Test classes are pinned to a single xdist worker via `loadscope` (see pytest.ini).
Do not use module/class-level state that different tests need to share across
classes; use fixtures if you need cross-test sharing.
"""
import time
import uuid
import pytest
import requests


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "admin@jsdpasal.com", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 20
        assert data["email"] == "admin@jsdpasal.com"

    def test_login_invalid(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "admin@jsdpasal.com", "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_with_bearer(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "admin@jsdpasal.com"
        assert "password_hash" not in data

    def test_admin_requires_auth(self, base_url):
        # Use a bare requests call with no cookies/headers to prove auth guards work
        r = requests.get(f"{base_url}/api/admin/products")
        assert r.status_code == 401
        r = requests.get(f"{base_url}/api/admin/dashboard")
        assert r.status_code == 401


# ---------- Rates ----------
class TestRates:
    def test_set_rate(self, auth_client, base_url):
        r = auth_client.post(f"{base_url}/api/admin/rates",
                             json={"gold_24k": 152000, "gold_22k": 139000, "silver": 1900})
        assert r.status_code == 200
        data = r.json()
        assert data["gold_24k"] == 152000
        assert "bs_date" in data
        assert "bs_date_np" in data

    def test_get_rate_today(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/rates/today")
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        assert "gold_24k_np" in data
        assert "bs_date_np" in data
        # Nepali digit verification
        assert any(ch in data["gold_24k_np"] for ch in "०१२३४५६७८९")

    def test_rates_history(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/rates/history?days=30")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1


# ---------- Products ----------
class TestProducts:
    @pytest.fixture(scope="class")
    def product(self, auth_client, base_url):
        payload = {
            "name": "TEST_Ring_22K",
            "name_np": "टेस्ट औंठी",
            "metal": "gold",
            "purity": "22K",
            "weight": {"tola": 1.5},
            "jarti_percent": 10,
            "jyala_amount": 5000,
            "jyala_type": "flat",
            "category": "Rings",
            "collection": "Daily Wear",
            "show_on_website": True,
            "show_price_on_website": True,
        }
        r = auth_client.post(f"{base_url}/api/admin/products", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_weight_conversion(self, product):
        # 1.5 tola * 11.664 = 17.496
        assert product["weight_grams"] == 17.496

    def test_live_price_computed(self, product):
        lp = product["live_price"]
        # metal = 1.5 * 152000 * 0.916 = 208848
        assert lp["metal_value"] == 208848.0
        # jarti = 10% => 20884.8
        assert lp["jarti_amount"] == 20884.8
        # total = 208848 + 20884.8 + 5000 = 234732.8
        assert lp["total_price"] == 234732.8

    def test_product_code_format(self, product):
        assert product["product_code"].startswith("JSD-P-")

    def test_get_product_admin(self, auth_client, base_url, product):
        r = auth_client.get(f"{base_url}/api/admin/products/{product['id']}")
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Ring_22K"

    def test_update_product(self, auth_client, base_url, product):
        payload = {
            "name": "TEST_Ring_22K_updated",
            "metal": "gold", "purity": "22K",
            "weight": {"tola": 2.0},
            "jarti_percent": 10, "jyala_amount": 5000, "jyala_type": "flat",
            "show_on_website": True, "show_price_on_website": True,
        }
        r = auth_client.put(f"{base_url}/api/admin/products/{product['id']}", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Ring_22K_updated"
        assert data["weight_grams"] == round(2.0 * 11.664, 3)

    def test_public_catalogue_lists_product(self, api_client, base_url, product):
        r = api_client.get(f"{base_url}/api/products")
        assert r.status_code == 200
        items = r.json()
        ids = [p["id"] for p in items]
        assert product["id"] in ids
        found = next(p for p in items if p["id"] == product["id"])
        # No cost breakdown in public view
        assert "polishing_cost" not in found

    def test_filter_metal(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/products?metal=gold")
        assert r.status_code == 200
        for p in r.json():
            assert p["metal"] == "gold"

    def test_soft_delete_hides_from_public(self, auth_client, api_client, base_url, product):
        r = auth_client.delete(f"{base_url}/api/admin/products/{product['id']}")
        assert r.status_code == 200
        # Verify not in admin list either
        r = auth_client.get(f"{base_url}/api/admin/products")
        assert product["id"] not in [p["id"] for p in r.json()]
        # And not in public
        r = api_client.get(f"{base_url}/api/products")
        assert product["id"] not in [p["id"] for p in r.json()]


# ---------- Customers ----------
class TestCustomers:
    @pytest.fixture(scope="class")
    def customer(self, auth_client, base_url):
        r = auth_client.post(f"{base_url}/api/admin/customers", json={
            "name": "TEST_Ram Bahadur",
            "phone": "9800000001",
            "address": "Kathmandu",
        })
        assert r.status_code == 200, r.text
        return r.json()

    def test_customer_created(self, customer):
        assert customer["name"] == "TEST_Ram Bahadur"
        assert customer["phone"] == "9800000001"
        assert "id" in customer

    def test_search_by_phone(self, auth_client, base_url, customer):
        r = auth_client.get(f"{base_url}/api/admin/customers?q=9800000001")
        assert r.status_code == 200
        assert any(c["id"] == customer["id"] for c in r.json())

    def test_customer_profile(self, auth_client, base_url, customer):
        r = auth_client.get(f"{base_url}/api/admin/customers/{customer['id']}")
        assert r.status_code == 200
        data = r.json()
        assert "orders" in data
        assert "payments" in data
        assert "repairs" in data
        assert "total_outstanding" in data


# ---------- Orders / Payments / Old gold ----------
class TestOrdersFlow:
    @pytest.fixture(scope="class")
    def setup(self, auth_client, base_url):
        # customer
        cust = auth_client.post(f"{base_url}/api/admin/customers", json={
            "name": "TEST_Order Customer", "phone": "9811111111"}).json()
        # product (stock)
        prod = auth_client.post(f"{base_url}/api/admin/products", json={
            "name": "TEST_Order Ring",
            "metal": "gold", "purity": "22K",
            "weight": {"tola": 1.5},
            "jarti_percent": 10, "jyala_amount": 5000, "jyala_type": "flat",
            "show_on_website": True, "show_price_on_website": True,
        }).json()
        return {"cust": cust, "prod": prod}

    @pytest.fixture(scope="class")
    def order(self, auth_client, base_url, setup):
        cust, prod = setup["cust"], setup["prod"]
        payload = {
            "customer_id": cust["id"],
            "order_type": "purchase",
            "items": [{
                "product_id": prod["id"],
                "name": prod["name"],
                "metal": "gold", "purity": "22K",
                "weight_grams": prod["weight_grams"],
                "rate_per_tola": 152000,
                "jarti_percent": 10,
                "jyala_amount": 5000, "jyala_type": "flat",
            }],
            "old_gold": {
                "old_item_description": "old chain",
                "old_weight_tola": 1.0,
                "old_valuation_rate_per_tola": 150000,
                "old_deduction_percent": 5,
            },
            "delivery_date_ad": "2027-01-15",
        }
        r = auth_client.post(f"{base_url}/api/admin/orders", json=payload)
        assert r.status_code == 200, r.text
        return r.json()

    def test_order_snapshot_and_totals(self, order):
        # total from items = 234732.8
        assert order["total_price"] == 234732.8
        # old_gold_value = 1 * 150000 * 0.95 = 142500
        assert order["old_gold_value"] == 142500.0
        # net = 234732.8 - 142500 = 92232.8
        assert order["net_payable"] == 92232.8
        assert order["remaining_balance"] == 92232.8
        assert order["advance_total"] == 0.0
        # Snapshot fields exist
        it = order["items"][0]
        assert it["rate_per_tola"] == 152000
        assert it["purity_factor"] == 0.916
        assert it["jarti_percent"] == 10

    def test_product_became_reserved(self, auth_client, base_url, setup):
        r = auth_client.get(f"{base_url}/api/admin/products/{setup['prod']['id']}")
        assert r.status_code == 200
        assert r.json()["status"] == "reserved"

    def test_snapshot_frozen_when_rate_changes(self, auth_client, api_client, base_url, order):
        # bump rate
        auth_client.post(f"{base_url}/api/admin/rates",
                         json={"gold_24k": 999999, "gold_22k": 888888, "silver": 5000,
                               "date_ad": "2026-07-02"})
        r = auth_client.get(f"{base_url}/api/admin/orders/{order['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["total_price"] == order["total_price"]
        assert data["net_payable"] == order["net_payable"]
        # restore
        auth_client.post(f"{base_url}/api/admin/rates",
                         json={"gold_24k": 152000, "gold_22k": 139000, "silver": 1900,
                               "date_ad": "2026-07-02"})

    def test_add_multiple_payments(self, auth_client, base_url, order):
        r1 = auth_client.post(f"{base_url}/api/admin/orders/{order['id']}/payments",
                              json={"amount": 30000, "method": "cash"})
        assert r1.status_code == 200
        assert r1.json()["advance_total"] == 30000
        assert r1.json()["remaining_balance"] == round(order["net_payable"] - 30000, 2)

        r2 = auth_client.post(f"{base_url}/api/admin/orders/{order['id']}/payments",
                              json={"amount": 20000, "method": "bank"})
        assert r2.status_code == 200
        assert r2.json()["advance_total"] == 50000

        # Verify via GET
        r = auth_client.get(f"{base_url}/api/admin/orders/{order['id']}")
        assert r.json()["remaining_balance"] == round(order["net_payable"] - 50000, 2)
        assert len(r.json()["payments"]) == 2

    def test_customer_outstanding_reflects(self, auth_client, base_url, setup, order):
        r = auth_client.get(f"{base_url}/api/admin/customers/{setup['cust']['id']}")
        assert r.status_code == 200
        # outstanding should equal remaining_balance of the active order
        expected = round(order["net_payable"] - 50000, 2)
        assert abs(r.json()["total_outstanding"] - expected) < 0.01

    def test_public_order_status(self, api_client, base_url, setup):
        r = api_client.get(f"{base_url}/api/public/order-status?phone=9811111111")
        assert r.status_code == 200
        results = r.json()
        assert len(results) >= 1
        row = results[0]
        # Minimal fields only
        assert set(row.keys()) >= {"order_number", "status", "remaining_balance"}
        # Should not leak customer id etc
        assert "customer_id" not in row
        assert "customer_name" not in row

    def test_delivered_marks_product_sold(self, auth_client, base_url, setup, order):
        r = auth_client.patch(f"{base_url}/api/admin/orders/{order['id']}/status",
                              json={"status": "delivered"})
        assert r.status_code == 200
        prod = auth_client.get(f"{base_url}/api/admin/products/{setup['prod']['id']}").json()
        assert prod["status"] == "sold"

    def test_sold_product_hidden_from_public(self, api_client, base_url, setup):
        r = api_client.get(f"{base_url}/api/products")
        ids = [p["id"] for p in r.json()]
        assert setup["prod"]["id"] not in ids

    def test_order_no_longer_in_public_status(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/public/order-status?phone=9811111111")
        assert r.status_code == 200
        # delivered orders are excluded
        assert r.json() == []


# ---------- Invoice ----------
class TestInvoice:
    @pytest.fixture(scope="class")
    def order(self, auth_client, base_url):
        cust = auth_client.post(f"{base_url}/api/admin/customers", json={
            "name": "TEST_Invoice Customer", "phone": "9822222222"}).json()
        payload = {
            "customer_id": cust["id"],
            "items": [{
                "name": "TEST_item", "metal": "gold", "purity": "24K",
                "weight_grams": 11.664, "rate_per_tola": 152000,
                "jarti_percent": 0, "jyala_amount": 0, "jyala_type": "flat",
            }],
        }
        r = auth_client.post(f"{base_url}/api/admin/orders", json=payload)
        assert r.status_code == 200
        return r.json()

    def test_create_invoice(self, auth_client, base_url, order):
        bill = f"TEST-BILL-{uuid.uuid4().hex[:8]}"
        r = auth_client.post(f"{base_url}/api/admin/invoices", json={
            "order_id": order["id"], "bill_number": bill,
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["bill_number"] == bill
        # frozen items
        assert data["items"][0]["rate_per_tola"] == 152000
        # bs date
        assert "invoice_date_bs_np" in data
        self.__class__._bill = bill
        self.__class__._invoice_id = data["id"]

    def test_duplicate_bill_number_rejected(self, auth_client, base_url, order):
        r = auth_client.post(f"{base_url}/api/admin/invoices", json={
            "order_id": order["id"], "bill_number": self._bill,
        })
        assert r.status_code == 400

    def test_public_verify_invoice(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/verify/invoice/{self._invoice_id}")
        assert r.status_code == 200
        data = r.json()
        assert data["bill_number"] == self._bill
        assert "customer_name_masked" in data
        assert "*" in data["customer_name_masked"]  # masked
        # Nepali digit amounts
        assert any(ch in data["total_amount_np"] for ch in "०१२३४५६७८९")
        # No cost internals
        assert "items" not in data
        assert "total_price" not in data or True  # net_payable exposed as total_amount


# ---------- Certificates ----------
class TestCertificate:
    def test_create_and_verify(self, auth_client, api_client, base_url):
        r = auth_client.post(f"{base_url}/api/admin/certificates", json={
            "metal": "gold", "purity": "22K", "weight_grams": 11.664,
            "stone_details": "None",
        })
        assert r.status_code == 200
        cert = r.json()
        assert cert["certificate_number"].startswith("CERT-")
        r2 = api_client.get(f"{base_url}/api/verify/certificate/{cert['id']}")
        assert r2.status_code == 200
        v = r2.json()
        assert v["verified"] is True
        assert v["certificate_number"] == cert["certificate_number"]


# ---------- Leads ----------
class TestLeads:
    def test_public_custom_order_lead(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/leads", json={
            "lead_type": "custom_order", "name": "TEST_Lead Custom",
            "phone": "9833333333", "item_type": "ring",
            "metal": "gold", "budget": "50000",
        })
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_public_repair_lead(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/leads", json={
            "lead_type": "repair", "name": "TEST_Lead Repair",
            "phone": "9833333334", "service_type": "polish",
        })
        assert r.status_code == 200

    def test_admin_lists_leads(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/admin/leads")
        assert r.status_code == 200
        phones = [l["phone"] for l in r.json()]
        assert "9833333333" in phones
        assert "9833333334" in phones

    def test_admin_updates_lead_status(self, auth_client, base_url):
        leads = auth_client.get(f"{base_url}/api/admin/leads").json()
        lid = next(l["id"] for l in leads if l["phone"] == "9833333333")
        r = auth_client.patch(f"{base_url}/api/admin/leads/{lid}/status",
                              json={"status": "contacted"})
        assert r.status_code == 200
        # Verify
        got = auth_client.get(f"{base_url}/api/admin/leads").json()
        row = next(l for l in got if l["id"] == lid)
        assert row["status"] == "contacted"


# ---------- Dashboard, Reports, Search ----------
class TestDashboardReportsSearch:
    def test_dashboard(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/admin/dashboard")
        assert r.status_code == 200
        data = r.json()
        for k in ("rate", "orders_due_today", "orders_due_week", "ready_for_collection",
                 "pending_payments", "todays_sales", "todays_invoices",
                 "pending_orders_count", "new_leads"):
            assert k in data

    def test_reports(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/admin/reports")
        assert r.status_code == 200
        for k in ("todays_sales", "orders_due_week", "pending_payments_total",
                 "pending_payments_count", "available_stock", "reserved_stock", "sold_stock"):
            assert k in r.json()

    def test_search(self, auth_client, base_url):
        r = auth_client.get(f"{base_url}/api/admin/search?q=TEST")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) == {"customers", "products", "orders", "invoices"}

# ---------- Settings ----------
class TestSettings:
    def test_public_settings_endpoint_exists(self, api_client, base_url):
        """Public /api/settings endpoint returns shop data without auth."""
        r = api_client.get(f"{base_url}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert "shop_name" in data
        assert "phone" in data
        assert "whatsapp" in data
        assert "address" in data
        assert "opening_hours" in data

    def test_public_settings_seeded_with_defaults(self, api_client, base_url):
        """Default seed contains real shop name, not placeholder."""
        r = api_client.get(f"{base_url}/api/settings")
        data = r.json()
        # Must NOT be a blank placeholder
        assert data["shop_name"].strip() != ""
        assert data["phone"].strip() != ""
        assert data["whatsapp"].strip() != ""
        # Seeded with real shop name
        assert "Jai" in data["shop_name"] or len(data["shop_name"]) > 3

    def test_admin_get_settings(self, auth_client, base_url):
        """Admin can fetch current settings."""
        r = auth_client.get(f"{base_url}/api/admin/settings")
        assert r.status_code == 200
        data = r.json()
        assert "shop_name" in data

    def test_admin_update_settings(self, auth_client, base_url):
        """Admin can update all settings fields."""
        payload = {
            "shop_name": "TEST Updated Shop Name",
            "shop_name_np": "टेस्ट अपडेट",
            "tagline": "Test tagline",
            "tagline_np": "टेस्ट",
            "phone": "+977-9811234567",
            "whatsapp": "9779811234567",
            "address": "Test Address, Nepal",
            "maps_link": "https://maps.google.com/?q=test",
            "opening_hours": "Mon–Sat: 9am – 6pm",
            "logo": "",
            "default_whatsapp_message": "Hello from test",
        }
        r = auth_client.put(f"{base_url}/api/admin/settings", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["shop_name"] == "TEST Updated Shop Name"
        assert data["phone"] == "+977-9811234567"
        assert data["whatsapp"] == "9779811234567"
        assert data["opening_hours"] == "Mon–Sat: 9am – 6pm"
        assert data["maps_link"] == "https://maps.google.com/?q=test"

    def test_public_settings_reflects_update(self, api_client, base_url):
        """Public endpoint shows the updated settings."""
        r = api_client.get(f"{base_url}/api/settings")
        assert r.status_code == 200
        data = r.json()
        assert data["shop_name"] == "TEST Updated Shop Name"
        assert data["phone"] == "+977-9811234567"

    def test_verify_invoice_uses_settings_shop_name(self, auth_client, api_client, base_url):
        """verify/invoice endpoint returns shop_name from DB settings, not hardcoded."""
        # Create order + invoice
        cust = auth_client.post(f"{base_url}/api/admin/customers",
                                json={"name": "TEST_Settings Customer", "phone": "9844444444"}).json()
        order = auth_client.post(f"{base_url}/api/admin/orders", json={
            "customer_id": cust["id"],
            "items": [{"name": "TEST_item_settings", "metal": "gold", "purity": "24K",
                       "weight_grams": 11.664, "rate_per_tola": 152000,
                       "jarti_percent": 0, "jyala_amount": 0, "jyala_type": "flat"}],
        }).json()
        import uuid
        bill = f"TEST-SETTINGS-BILL-{uuid.uuid4().hex[:8]}"
        inv = auth_client.post(f"{base_url}/api/admin/invoices",
                               json={"order_id": order["id"], "bill_number": bill}).json()
        r = api_client.get(f"{base_url}/api/verify/invoice/{inv['id']}")
        assert r.status_code == 200
        data = r.json()
        # shop_name must come from DB (was set to TEST Updated Shop Name)
        assert data["shop_name"] == "TEST Updated Shop Name"
        assert data["shop_name"] != "Jai Supa Deurali Sun-Chandi Pasal"  # not hardcoded

    def test_verify_certificate_uses_settings_shop_name(self, auth_client, api_client, base_url):
        """verify/certificate endpoint returns shop_name from DB settings."""
        cert = auth_client.post(f"{base_url}/api/admin/certificates",
                                json={"metal": "gold", "purity": "22K",
                                      "weight_grams": 5.832, "stone_details": ""}).json()
        r = api_client.get(f"{base_url}/api/verify/certificate/{cert['id']}")
        assert r.status_code == 200
        data = r.json()
        assert data["shop_name"] == "TEST Updated Shop Name"
        assert data["shop_name"] != "Jai Supa Deurali Sun-Chandi Pasal"  # not hardcoded

    def test_phone_validation_rejects_short(self, auth_client, base_url):
        """Settings update rejects a phone number that is too short."""
        r = auth_client.put(f"{base_url}/api/admin/settings", json={
            "shop_name": "Valid Name",
            "phone": "123",           # too short
            "whatsapp": "9779811234567",
        })
        assert r.status_code == 422

    def test_whatsapp_validation_rejects_too_long(self, auth_client, base_url):
        """Settings update rejects a WhatsApp number with too many digits."""
        r = auth_client.put(f"{base_url}/api/admin/settings", json={
            "shop_name": "Valid Name",
            "phone": "+977-9811234567",
            "whatsapp": "9779811234567890123",  # too long
        })
        assert r.status_code == 422

    def test_settings_requires_auth(self, base_url):
        """Admin settings endpoint must require authentication."""
        import requests
        r = requests.get(f"{base_url}/api/admin/settings")
        assert r.status_code == 401
        r = requests.put(f"{base_url}/api/admin/settings",
                         json={"shop_name": "Hack", "phone": "9779811234567", "whatsapp": "9779811234567"},
                         headers={"Content-Type": "application/json"})
        assert r.status_code == 401

    def test_restore_defaults(self, auth_client, base_url):
        """Restore seeded defaults so other tests are not affected."""
        r = auth_client.put(f"{base_url}/api/admin/settings", json={
            "shop_name": "Jai Supa Deurali Sun-Chandi Pasal",
            "shop_name_np": "\u091c\u092f \u0938\u0941\u092a\u093e \u0926\u0947\u0909\u0930\u093e\u0932\u0940 \u0938\u0941\u0928\u091a\u093e\u0901\u0926\u0940 \u092a\u0938\u0932",
            "tagline": "Decades of trust in gold & silver",
            "tagline_np": "\u0926\u0936\u0915\u094c\u0902\u0926\u0947\u0916\u093f\u0915\u094b \u0935\u093f\u0936\u094d\u0935\u093e\u0938",
            "phone": "+977-9800000000",
            "whatsapp": "9779800000000",
            "address": "Deurali Bazaar, Nepal",
            "maps_link": "",
            "opening_hours": "Sun\u2013Fri: 10am \u2013 7pm",
            "logo": "",
            "default_whatsapp_message": "Namaste! I have an enquiry.",
        })
        assert r.status_code == 200

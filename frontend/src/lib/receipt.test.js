import { sanitizeWhatsappPhone, orderWhatsappLink, orderStatusLink, buildOrderWhatsappMessage } from "./receipt";

describe("sanitizeWhatsappPhone", () => {
  test("strips spaces, dashes, and a leading +", () => {
    expect(sanitizeWhatsappPhone("+977-98 1234 5678")).toBe("9779812345678");
  });
  test("accepts a plain local 10-digit number", () => {
    expect(sanitizeWhatsappPhone("9812345678")).toBe("9812345678");
  });
  test("accepts a 977-prefixed number", () => {
    expect(sanitizeWhatsappPhone("9779812345678")).toBe("9779812345678");
  });
  test("rejects missing phone", () => {
    expect(sanitizeWhatsappPhone("")).toBeNull();
    expect(sanitizeWhatsappPhone(null)).toBeNull();
    expect(sanitizeWhatsappPhone(undefined)).toBeNull();
  });
  test("rejects too-short garbage", () => {
    expect(sanitizeWhatsappPhone("12")).toBeNull();
  });
});

describe("orderWhatsappLink", () => {
  test("returns null when the order has no usable phone", () => {
    expect(orderWhatsappLink({ customer_phone: "" }, "hi")).toBeNull();
    expect(orderWhatsappLink({}, "hi")).toBeNull();
  });
  test("builds a wa.me link with sanitized digits and encoded message", () => {
    const link = orderWhatsappLink({ customer_phone: "+977-9812345678" }, "hello there");
    expect(link).toBe("https://wa.me/9779812345678?text=hello%20there");
  });
});

describe("orderStatusLink", () => {
  test("includes the order number as a query param", () => {
    const link = orderStatusLink({ order_number: "ORD-0001" });
    expect(link).toContain("/order-status?order_number=ORD-0001");
  });
  test("falls back to the bare page when order number is missing", () => {
    const link = orderStatusLink({});
    expect(link).toMatch(/\/order-status$/);
  });
});

describe("buildOrderWhatsappMessage", () => {
  test("includes shop name, order number, status, delivery date, amounts, and a status link", () => {
    const order = {
      order_number: "ORD-0007",
      status: "in_progress",
      delivery_date_ad: "2026-08-01",
      net_payable: 50000,
      advance_total: 10000,
      remaining_balance: 40000,
    };
    const msg = buildOrderWhatsappMessage(order, "Jai Supa Deurali Sun-Chandi Pasal");
    expect(msg).toContain("Jai Supa Deurali Sun-Chandi Pasal");
    expect(msg).toContain("ORD-0007");
    expect(msg).toContain("in progress");
    expect(msg).toContain("2026-08-01");
    expect(msg).toContain("Rs. 50,000");
    expect(msg).toContain("Rs. 10,000");
    expect(msg).toContain("Rs. 40,000");
    expect(msg).toContain("/order-status?order_number=ORD-0007");
  });

  test("omits the delivery-date line when there is no delivery date", () => {
    const order = { order_number: "ORD-0008", status: "new", net_payable: 0, advance_total: 0, remaining_balance: 0 };
    const msg = buildOrderWhatsappMessage(order, "Shop");
    expect(msg).not.toContain("Delivery date");
  });
});

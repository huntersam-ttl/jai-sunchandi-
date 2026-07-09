import { billWhatsappLink, buildBillWhatsappMessage, buildBillReferenceText, isAcceptedBillImageType } from "./billArchive";

describe("billWhatsappLink", () => {
  test("returns null for a missing/invalid phone (never a broken wa.me link)", () => {
    expect(billWhatsappLink("", "hello")).toBeNull();
    expect(billWhatsappLink(undefined, "hello")).toBeNull();
    expect(billWhatsappLink("12", "hello")).toBeNull();
  });
  test("builds a sanitized wa.me link for a valid phone", () => {
    const link = billWhatsappLink("+977-98 1234 5678", "bill text");
    expect(link).toBe("https://wa.me/9779812345678?text=bill%20text");
  });
});

describe("buildBillWhatsappMessage", () => {
  const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN");
  test("includes shop name, bill number, date, amount, and the clarification line", () => {
    const bill = { bill_number: "BILL-0007", bill_date: "2026-07-09", total_amount: 50000 };
    const msg = buildBillWhatsappMessage(bill, "Jai Supa Deurali Sun-Chandi Pasal", rs);
    expect(msg).toContain("Jai Supa Deurali Sun-Chandi Pasal");
    expect(msg).toContain("Here is your bill record:");
    expect(msg).toContain("Bill No: BILL-0007");
    expect(msg).toContain("Date: 2026-07-09");
    expect(msg).toContain("Rs. 50,000");
    expect(msg).toContain("Please contact us if you need any clarification.");
  });
  test("falls back to a dash for missing fields instead of crashing", () => {
    const msg = buildBillWhatsappMessage({}, "Shop", rs);
    expect(msg).toContain("Bill No: —");
    expect(msg).toContain("Date: —");
    expect(msg).toContain("Amount: —");
  });
});

describe("buildBillReferenceText", () => {
  test("joins bill number, date, and customer name", () => {
    const text = buildBillReferenceText({ bill_number: "BILL-0007", bill_date: "2026-07-09", customer_name: "Ram Shrestha" });
    expect(text).toBe("BILL-0007 · 2026-07-09 · Ram Shrestha");
  });
  test("skips missing fields rather than showing empty separators", () => {
    const text = buildBillReferenceText({ bill_number: "BILL-0007" });
    expect(text).toBe("BILL-0007");
  });
});

describe("isAcceptedBillImageType", () => {
  test("accepts jpeg, png, and webp", () => {
    expect(isAcceptedBillImageType({ type: "image/jpeg" })).toBe(true);
    expect(isAcceptedBillImageType({ type: "image/png" })).toBe(true);
    expect(isAcceptedBillImageType({ type: "image/webp" })).toBe(true);
  });
  test("rejects a clearly wrong type like a PDF", () => {
    expect(isAcceptedBillImageType({ type: "application/pdf" })).toBe(false);
  });
  test("accepts a missing/empty type -- some mobile camera captures never fill it in", () => {
    expect(isAcceptedBillImageType({ type: "" })).toBe(true);
  });
  test("rejects a missing file", () => {
    expect(isAcceptedBillImageType(null)).toBe(false);
    expect(isAcceptedBillImageType(undefined)).toBe(false);
  });
});

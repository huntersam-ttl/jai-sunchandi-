import { sanitizeWhatsappPhone } from "./receipt";

export { sanitizeWhatsappPhone };

export function billWhatsappLink(phone, message) {
  const digits = sanitizeWhatsappPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildBillWhatsappMessage(bill, shopName, rs) {
  const formatAmount = (n) => (rs ? rs(n) : String(n));
  const lines = [
    `Namaste from ${shopName || "the shop"}.`,
    "Here is your bill record:",
    `Bill No: ${bill.bill_number || "—"}`,
    `Date: ${bill.bill_date || "—"}`,
    `Amount: ${bill.total_amount != null ? formatAmount(bill.total_amount) : "—"}`,
    "Please contact us if you need any clarification.",
  ];
  return lines.join("\n");
}

export function buildBillReferenceText(bill) {
  const parts = [bill.bill_number, bill.bill_date, bill.customer_name].filter(Boolean);
  return parts.join(" · ");
}

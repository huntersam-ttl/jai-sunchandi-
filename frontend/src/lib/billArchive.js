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

export const ACCEPTED_BILL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Some mobile camera captures report an empty file.type (the browser never
// filled it in) -- treat that as acceptable rather than blocking a real
// photo just because MIME sniffing didn't run. Only reject a file whose
// browser-reported type is definitely something else (e.g. a PDF).
export function isAcceptedBillImageType(file) {
  if (!file) return false;
  if (!file.type) return true;
  return ACCEPTED_BILL_IMAGE_TYPES.includes(file.type);
}

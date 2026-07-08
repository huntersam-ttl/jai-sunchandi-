import { rs } from "./format";

/**
 * Nepali phone numbers show up as "98XXXXXXXX", "+977-98XXXXXXXX",
 * "977 98XXXXXXXX", etc. wa.me needs digits only, no leading "+" or
 * spaces/dashes. Returns null (never a broken link) if what's left isn't a
 * plausible phone number.
 */
export function sanitizeWhatsappPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function orderWhatsappLink(order, message) {
  const digits = sanitizeWhatsappPhone(order?.customer_phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Public order-status page link -- order number only, no phone/secret. */
export function orderStatusLink(order) {
  const base = `${window.location.origin}/order-status`;
  if (!order?.order_number) return base;
  return `${base}?order_number=${encodeURIComponent(order.order_number)}`;
}

export function buildOrderWhatsappMessage(order, shopName) {
  const lines = [
    `Namaste! ${shopName || "Shop"}`,
    `Order: ${order.order_number}`,
    `Status: ${(order.status || "").replace(/_/g, " ")}`,
  ];
  if (order.delivery_date_ad) lines.push(`Delivery date: ${order.delivery_date_ad}`);
  lines.push(`Total: ${rs(order.net_payable)}`);
  lines.push(`Advance paid: ${rs(order.advance_total)}`);
  lines.push(`Remaining balance: ${rs(order.remaining_balance)}`);
  lines.push(`Check status: ${orderStatusLink(order)}`);
  return lines.join("\n");
}

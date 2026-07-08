import { GRAMS_PER_TOLA, PURITY_FACTORS } from "./format";
import { sanitizeWhatsappPhone } from "./receipt";

export { GRAMS_PER_TOLA, PURITY_FACTORS };

/** Same tola/lal/aana -> grams conversion used by the product form
 * (16 aana = 1 lal, 100 lal = 1 tola). */
export function tolaLalAanaToGrams(tola = 0, lal = 0, aana = 0) {
  const totalTola = (+tola || 0) + (+aana || 0) / 16 + (+lal || 0) / 100;
  return Math.round(totalTola * GRAMS_PER_TOLA * 1000) / 1000;
}

export function gramsToTola(grams) {
  return Math.round((grams / GRAMS_PER_TOLA) * 10000) / 10000;
}

/**
 * Mirrors backend/utils.py's compute_price() exactly, so a counter quote
 * matches what an actual order would calculate: metal value from weight in
 * tola (rate is per-tola) x purity factor, plus jarti %, plus jyala (flat or
 * per-tola), plus flat extras, minus discount.
 */
export function computeQuote({
  weightGrams, ratePerTola, purity,
  jartiPercent = 0, jyalaAmount = 0, jyalaType = "flat",
  stoneCost = 0, polishingCost = 0, cuttingCost = 0, workerCharge = 0, otherCost = 0,
  discount = 0,
}) {
  const grams = +weightGrams || 0;
  const tola = grams / GRAMS_PER_TOLA;
  const factor = PURITY_FACTORS[purity] ?? 1.0;
  const rate = +ratePerTola || 0;
  const metalValue = tola * rate * factor;
  const jartiAmount = metalValue * ((+jartiPercent || 0) / 100);
  const jyala = jyalaType === "per_tola" ? (+jyalaAmount || 0) * tola : (+jyalaAmount || 0);
  const otherExtras = (+stoneCost || 0) + (+polishingCost || 0) + (+cuttingCost || 0)
    + (+workerCharge || 0) + (+otherCost || 0);
  const finalPrice = metalValue + jartiAmount + jyala + otherExtras - (+discount || 0);

  return {
    weightGrams: Math.round(grams * 1000) / 1000,
    weightTola: Math.round(tola * 10000) / 10000,
    ratePerTola: rate,
    purity,
    purityFactor: factor,
    metalValue: Math.round(metalValue * 100) / 100,
    jartiPercent: +jartiPercent || 0,
    jartiAmount: Math.round(jartiAmount * 100) / 100,
    jyalaAmount: Math.round(jyala * 100) / 100,
    extras: Math.round(otherExtras * 100) / 100, // stone+polish+cutting+worker+other -- jyala shown separately
    discount: +discount || 0,
    finalPrice: Math.round(finalPrice * 100) / 100,
  };
}

export { sanitizeWhatsappPhone };

export function quoteWhatsappLink(phone, message) {
  const digits = sanitizeWhatsappPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Formats a quote breakdown as plain text for both "Copy Quote" and the
 * WhatsApp message body. */
export function buildQuoteText(quote, shopName, rs) {
  const lines = [
    `Namaste from ${shopName || "the shop"}`,
    `${quote.metal ? quote.metal + " " : ""}${quote.purity}`,
    `Weight: ${quote.weightGrams} g (${quote.weightTola} tola)`,
    `Rate used: ${rs(quote.ratePerTola)}/tola`,
    `Estimated price: ${rs(quote.finalPrice)}`,
    "Note: Final price may vary after physical weight/checking.",
  ];
  return lines.join("\n");
}

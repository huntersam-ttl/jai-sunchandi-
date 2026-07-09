import {
  tolaLalAanaToGrams, gramsToTola, computeQuote, quoteWhatsappLink, buildQuoteText,
  resolveRatePerTola, GRAMS_PER_TOLA, PURITY_FACTORS,
} from "./calculator";

describe("tolaLalAanaToGrams", () => {
  test("1 tola equals GRAMS_PER_TOLA grams", () => {
    expect(tolaLalAanaToGrams(1, 0, 0)).toBeCloseTo(GRAMS_PER_TOLA, 3);
  });
  test("100 lal equals 1 tola", () => {
    expect(tolaLalAanaToGrams(0, 100, 0)).toBeCloseTo(GRAMS_PER_TOLA, 3);
  });
  test("16 aana equals 1 whole tola (matches Products.js's existing tola+aana/16+lal/100 formula)", () => {
    expect(tolaLalAanaToGrams(0, 0, 16)).toBeCloseTo(GRAMS_PER_TOLA, 3);
  });
  test("defaults to 0 grams with no args", () => {
    expect(tolaLalAanaToGrams()).toBe(0);
  });
});

describe("gramsToTola", () => {
  test("round-trips with tolaLalAanaToGrams", () => {
    // 2 tola + 8 aana (8/16 = 0.5 tola) + 50 lal (50/100 = 0.5 tola) = 3 tola
    const grams = tolaLalAanaToGrams(2, 50, 8);
    expect(gramsToTola(grams)).toBeCloseTo(3, 3);
  });
});

describe("PURITY_FACTORS", () => {
  test("includes all required gold purities and silver", () => {
    expect(PURITY_FACTORS["24K"]).toBe(1.0);
    expect(PURITY_FACTORS["22K"]).toBeCloseTo(0.916, 3);
    expect(PURITY_FACTORS["21K"]).toBeCloseTo(0.875, 3);
    expect(PURITY_FACTORS["18K"]).toBe(0.75);
    expect(PURITY_FACTORS.silver).toBe(1.0);
  });
});

describe("computeQuote", () => {
  test("matches the shop's pricing formula for a simple 24K gold case", () => {
    // 1 tola (11.664g) of 24K gold at Rs 150,000/tola, 2% jarti, flat jyala 500.
    const q = computeQuote({
      weightGrams: GRAMS_PER_TOLA, ratePerTola: 150000, purity: "24K",
      jartiPercent: 2, jyalaAmount: 500, jyalaType: "flat",
    });
    expect(q.weightTola).toBeCloseTo(1, 4);
    expect(q.metalValue).toBeCloseTo(150000, 2);
    expect(q.jartiAmount).toBeCloseTo(3000, 2); // 2% of 150000
    expect(q.jyalaAmount).toBe(500);
    expect(q.finalPrice).toBeCloseTo(153500, 2); // 150000 + 3000 + 500
  });

  test("applies purity factor for 22K", () => {
    const q = computeQuote({ weightGrams: GRAMS_PER_TOLA, ratePerTola: 100000, purity: "22K" });
    expect(q.metalValue).toBeCloseTo(91600, 0); // 100000 * 0.916 (rounded)
  });

  test("applies purity factor for 21K", () => {
    const q = computeQuote({ weightGrams: GRAMS_PER_TOLA, ratePerTola: 100000, purity: "21K" });
    expect(q.metalValue).toBeCloseTo(87500, 0); // 100000 * 0.875
  });

  test("per-tola jyala scales with weight", () => {
    const q = computeQuote({
      weightGrams: GRAMS_PER_TOLA * 2, ratePerTola: 100000, purity: "24K",
      jyalaAmount: 1000, jyalaType: "per_tola",
    });
    expect(q.jyalaAmount).toBeCloseTo(2000, 2); // 1000/tola * 2 tola
  });

  test("sums extras and subtracts discount", () => {
    const q = computeQuote({
      weightGrams: GRAMS_PER_TOLA, ratePerTola: 100000, purity: "24K",
      stoneCost: 200, polishingCost: 100, cuttingCost: 50, workerCharge: 150, otherCost: 25,
      discount: 300,
    });
    expect(q.extras).toBeCloseTo(525, 2); // 200+100+50+150+25
    expect(q.finalPrice).toBeCloseTo(100000 + 525 - 300, 2);
  });

  test("zero weight or missing rate produces a zero quote, not NaN/crash", () => {
    const q = computeQuote({ weightGrams: 0, ratePerTola: 0, purity: "24K" });
    expect(q.finalPrice).toBe(0);
    expect(Number.isNaN(q.finalPrice)).toBe(false);
  });

  test("unknown purity falls back to factor 1.0 rather than crashing", () => {
    const q = computeQuote({ weightGrams: GRAMS_PER_TOLA, ratePerTola: 1000, purity: "unknown" });
    expect(q.purityFactor).toBe(1.0);
  });
});

describe("quoteWhatsappLink", () => {
  test("returns null for a missing/invalid phone (never a broken wa.me link)", () => {
    expect(quoteWhatsappLink("", "hello")).toBeNull();
    expect(quoteWhatsappLink(undefined, "hello")).toBeNull();
    expect(quoteWhatsappLink("12", "hello")).toBeNull();
  });
  test("builds a sanitized wa.me link for a valid phone", () => {
    const link = quoteWhatsappLink("+977-98 1234 5678", "quote text");
    expect(link).toBe("https://wa.me/9779812345678?text=quote%20text");
  });
});

describe("buildQuoteText", () => {
  const rs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-IN");
  test("includes shop name, purity, weight, rate, price, and the variance note", () => {
    const quote = computeQuote({ weightGrams: GRAMS_PER_TOLA, ratePerTola: 150000, purity: "24K" });
    const text = buildQuoteText({ ...quote, metal: "Gold" }, "Jai Supa Deurali Sun-Chandi Pasal", rs);
    expect(text).toContain("Jai Supa Deurali Sun-Chandi Pasal");
    expect(text).toContain("Gold 24K");
    expect(text).toContain("1 tola");
    expect(text).toContain("Rs. 1,50,000"); // en-IN locale groups as lakhs
    expect(text).toContain("Final price may vary after physical weight/checking.");
  });
});

describe("resolveRatePerTola", () => {
  const rate = { gold_24k: 150000, gold_22k: 140000, silver: 2000 };

  test("returns null with no rate at all (missing-rate fallback)", () => {
    expect(resolveRatePerTola(null, "gold", "24K")).toBeNull();
  });
  test("silver uses the published silver rate regardless of purity key", () => {
    expect(resolveRatePerTola(rate, "silver", "silver")).toBe(2000);
  });
  test("24K uses the published 24K rate directly", () => {
    expect(resolveRatePerTola(rate, "gold", "24K")).toBe(150000);
  });
  test("22K prefers the published 22K rate over deriving one", () => {
    expect(resolveRatePerTola(rate, "gold", "22K")).toBe(140000);
  });
  test("21K/18K derive from the 24K rate via the purity-factor ratio (not published)", () => {
    const r21 = resolveRatePerTola(rate, "gold", "21K");
    expect(r21).toBeCloseTo(150000 * (PURITY_FACTORS["21K"] / PURITY_FACTORS["24K"]), 2);
    const r18 = resolveRatePerTola(rate, "gold", "18K");
    expect(r18).toBeCloseTo(150000 * (PURITY_FACTORS["18K"] / PURITY_FACTORS["24K"]), 2);
  });
  test("22K derives from 24K when the rate table doesn't publish 22K separately", () => {
    const r = resolveRatePerTola({ gold_24k: 150000 }, "gold", "22K");
    expect(r).toBeCloseTo(150000 * (PURITY_FACTORS["22K"] / PURITY_FACTORS["24K"]), 2);
  });
  test("returns null when there is nothing to derive from", () => {
    expect(resolveRatePerTola({ silver: 2000 }, "gold", "24K")).toBeNull();
  });
});

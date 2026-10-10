import { validateDailyRateInput } from "./ratesInput";
const valid = {date_ad: "2026-10-10", gold_24k: "300000", gold_22k: "275000", silver: "5000"};
test("accepts explicit 22K pricing", () => { expect(validateDailyRateInput(valid)).toBeNull(); });
test("rejects missing 22K price", () => { expect(validateDailyRateInput({...valid,gold_22k:""})).toMatch(/22K Gold/); });
test("rejects 22K greater than 24K", () => { expect(validateDailyRateInput({...valid,gold_22k:"320000"})).toMatch(/above/); });
test("rejects invalid nonpositive and nonfinite values", () => {
  expect(validateDailyRateInput({...valid,silver:"0"})).toMatch(/Silver/);
  expect(validateDailyRateInput({...valid,gold_24k:"Infinity"})).toMatch(/24K Gold/);
});

/** Guard shopkeeper daily rate inputs; never infer 22K from 24K. */
export function validateDailyRateInput(form) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date_ad || "")) return "Select the rate date.";
  for (const [key, label] of [["gold_24k", "24K Gold"], ["gold_22k", "22K Gold"], ["silver", "Silver"]]) {
    if (String(form[key] ?? "").trim() === "" || !Number.isFinite(Number(form[key])) || Number(form[key]) <= 0) {
      return `Enter a positive ${label} rate.`;
    }
  }
  if (Number(form.gold_22k) > Number(form.gold_24k)) return "22K Gold should not be priced above 24K Gold.";
  return null;
}

// Measurement control markets. Savannah and York are the untouched CONTROL arm of the GSC
// treated-vs-control design (die-validation scripts/measure-gsc.mjs: Bruges/Charleston treated,
// York/Savannah control). Promoting them through growth surfaces (Today plan, reddit replies,
// outreach) would contaminate the experiment, so those surfaces must never show them. Rows for
// them may still exist in the DB; we only hide them from action queues.
export const CONTROL_MARKETS = ["savannah", "york"];

// Case-insensitive substring match against a market/city string, with one guard: "york" must not
// catch New York (a non-control market in REDDIT_CITIES), so any "new york"/"new-york" is
// scrubbed from the value before matching.
export function isControlMarket(value: string | null | undefined): boolean {
  if (!value) return false;
  const scrubbed = value.toLowerCase().replace(/new[\s-]*york/g, "");
  return CONTROL_MARKETS.some((m) => scrubbed.includes(m));
}

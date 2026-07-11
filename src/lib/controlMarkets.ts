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

// Facet-mint controls: the FULL experiment-control set — the GSC controls (Savannah/York) plus the
// analysis controls Fez and Venice(-historic). Consulted ONLY when a NEW rising-intent facet would
// mint a page (src/lib/travellerFit.ts conceptCityBlocked): creating a page for a control city
// would be NEW treatment of an experiment control, so those pages must never come into existence.
// Existing/legacy surfaces are untouched. EXACT match on the normalised city name, NEVER substring
// (mirrors scripts/seed-ig-outreach.mjs isIgControlCity): "New York" normalises to "new-york" and
// can never match "york"; "Yorkshire" can't either.
export const FACET_MINT_CONTROL_CITIES = ["savannah", "york", "fez", "venice", "venice-historic", "venezia"];
export function isFacetMintControlCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const norm = String(city).toLowerCase().trim().replace(/\s+/g, "-");
  return FACET_MINT_CONTROL_CITIES.includes(norm);
}

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

// Outreach control-city matcher (memory/findings/incident-control-city-form-leak-2026-07-21,
// spec-control-city-matcher-2026-07-21): the OLD exact-match lists above (IG_CONTROL_CITIES,
// FACET_MINT_CONTROL_CITIES) were only ever tested against the CANONICAL city spelling, and the
// live DB carries many other forms of the same real-world place — "Metropolitan City of
// Venice", "Fès"/"Fes Médina"/"FES medina"/"Fes El Bali - Medina", "York YO1 8BB" postcode
// suffixes. Exact-match against a short literal list traded the York/New-York substring hazard
// (correct) for silent FORM underreach (never tested): Venice-historic's exclusion excluded ZERO
// rows for months. The lesson generalises — an exclusion list is a claim about DATA, not just
// code, and must be validated against the live distinct-values it filters (see the incident
// finding + the runtime guard in scripts/seed-ig-outreach.mjs / scripts/seed-email-outreach.mjs,
// which enforces exactly that at every seed run).
//
// This matcher is FAMILY/TOKEN based, not a literal list, and is deliberately conservative
// (over-exclusion is the safe direction for outreach — controls must stay untouchable):
//   - savannah: exact full-string match only (no known multiword forms; keep tight).
//   - york: exact "york", or a postcode-suffixed form ("york-yo1-8bb", "york-yo24-1aa",
//     "york-yo62-5bj"). Never substring — "new-york"/"north-york"/"yorkshire" all fail because
//     their first token isn't "york" (or the whole string isn't exactly "york").
//   - fez: any "-"-separated token equals "fez" or "fes" (covers every Fez/Fès/Fes-medina
//     census form). "ffestiniog" is ONE token and never equals "fes", so Blaenau Ffestiniog is
//     never caught.
//   - venice: any token equals "venice" or "venezia" (covers "Venice", "Metropolitan City of
//     Venice", "Venezia").
export function isOutreachControlCity(city: string | null | undefined): boolean {
  if (!city) return false;
  const norm = String(city)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (Fès -> Fes, Médina -> Medina)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-");
  if (norm === "savannah") return true;
  if (norm === "york" || /^york-yo\d/.test(norm)) return true;
  const tokens = norm.split("-");
  if (tokens.includes("fez") || tokens.includes("fes")) return true;
  if (tokens.includes("venice") || tokens.includes("venezia")) return true;
  return false;
}

// Long-tail facets for programmatic city pages ("cosy hotels with a fireplace in Edinburgh").
// A hotel matches a facet when its real cosy signals or AI description mention it — so every
// facet page is backed by actual data, not generic filler. Pages with <2 matches don't render.
// `intro` (optional): a facet-specific opening sentence the theme hub prepends to its data-led
// intro line; used to carry rising-intent vocabulary (copywriting skill: demand vocabulary rule).
export type Facet = { slug: string; label: string; noun: string; re: RegExp; intro?: string };

export const FACETS: Facet[] = [
  { slug: "fireplace", label: "with a fireplace", noun: "a fireplace", re: /fireplace|hearth|log fire|wood[- ]?burn|open fire/i },
  { slug: "romantic", label: "for a romantic getaway", noun: "romance", re: /romanti|honeymoon|couples?\b|candle|four[- ]?poster/i },
  { slug: "spa", label: "with a spa", noun: "a spa", re: /\bspa\b|onsen|sauna|hot[- ]?spring|thermal|hammam|soaking tub|hot tub|wellness/i },
  { slug: "boutique", label: "boutique & independent", noun: "boutique character", re: /boutique|independent|design[- ]?led|design hotel|family[- ]?run|owner[- ]?run/i },
  { slug: "views", label: "with a view", noun: "the view", re: /\bview|panoram|overlook|rooftop|sea view|mountain|skyline/i },

  // ── Rising-intent facets (2026-07). Each names its verified rising intent (standing rule). ──
  // quiet/sleep — RISING INTENT: sleep tourism is the #1 leisure travel motivation at 56%
  // (Hilton/Ipsos, n>14k) and "hushpitality" demand sits at 57%. Regex is a strict SUPERSET of the
  // travellerFit "quiet" concept regex (adds silent/silence/calm/calming), and must stay IDENTICAL
  // to that concept's `re` (tests/rising-facets.test.ts pins both). Tuned against live data
  // 2026-07-12: 2,618 of 6,345 live hotels match; quiet is genuinely the most common atmosphere
  // theme in reviews (35.6% of 9,437), so breadth is real, not regex slop. Hazards handled: bare
  // "sleep" is deliberately NOT matched (every description mentions sleeping) and every word
  // carries \b boundaries (no "becalmed"/"recalmed").
  {
    slug: "quiet", label: "for a quiet night's sleep", noun: "a quiet night's sleep",
    intro: "The quietcation, or sleep tourism, trend has a point: a proper night's rest is now the main reason many travellers book a trip, and no amount of decor rescues a noisy room.",
    re: /\b(?:quiet|peaceful|tranquil|hushed|silent|silence|serene|restful|calm|calming|secluded)\b|away from the (?:crowd|hustle|bustle)|off the beaten/i,
  },

  // reading-retreat — RISING INTENT: 91% of travellers want reading-and-relaxation trips (Expedia
  // Unpack '26). Tuned against live data 2026-07-12 (149 of 6,345 live hotels): bare \bbook\b was
  // DROPPED after the data check surfaced "book a return stay"/"book train tickets" false
  // positives (71 singular-book hits, many junk); kept are plural \bbooks\b, "book collection" and
  // "with a book" (all clean in the random sample). "reading" only matches followed by
  // room/nook/corner/chair, so the city of Reading, England can never match, and
  // "booking"/"booked" never match (\bbooks\b requires a word boundary after the s).
  {
    slug: "reading-retreat", label: "for a reading retreat", noun: "a reading retreat",
    re: /librar(?:y|ies)|\bbooks\b|book collection|with a book\b|reading (?:room|nook|corner|chair)|window seat|armchair|fireside/i,
  },

  // farm-stay (agriturismo) — RISING INTENT: 84% farm-stay interest (Expedia). Slug is "farm-stay"
  // (the international search word); the label names agriturismo (the rising term). Tuned against
  // live data 2026-07-12 (166 of 6,345 live hotels): vineyard/winery were DROPPED after the data
  // check found 34 vineyard-only matches that are not farms (hotel names like "The Vineyard
  // Hotel", the place name Martha's Vineyard, city hotels with "vineyard views"); "wine list"
  // never matched and still can't. Overlap with the rustic concept (agriturismo|farmhouse) is
  // intended, like spa/sauna.
  {
    slug: "farm-stay", label: "on a farm or agriturismo", noun: "farm life",
    re: /agriturismo|farm[- ]?stay|farmhouse|working farm|masseria|olive (?:grove|trees)|orchard/i,
  },
];

export function facetBySlug(slug: string): Facet | undefined {
  return FACETS.find((f) => f.slug === slug);
}

// Does a hotel's real signals/description support this facet?
export function matchesFacet(f: Facet, signals: string[] | null | undefined, description: string | null | undefined): boolean {
  const hay = `${(signals || []).join(" ")} ${description || ""}`;
  return f.re.test(hay);
}

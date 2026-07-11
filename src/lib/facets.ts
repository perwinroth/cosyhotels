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
];

export function facetBySlug(slug: string): Facet | undefined {
  return FACETS.find((f) => f.slug === slug);
}

// Does a hotel's real signals/description support this facet?
export function matchesFacet(f: Facet, signals: string[] | null | undefined, description: string | null | undefined): boolean {
  const hay = `${(signals || []).join(" ")} ${description || ""}`;
  return f.re.test(hay);
}

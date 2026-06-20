// Long-tail facets for programmatic city pages ("cosy hotels with a fireplace in Edinburgh").
// A hotel matches a facet when its real cosy signals or AI description mention it — so every
// facet page is backed by actual data, not generic filler. Pages with <2 matches don't render.
export type Facet = { slug: string; label: string; noun: string; re: RegExp };

export const FACETS: Facet[] = [
  { slug: "fireplace", label: "with a fireplace", noun: "a fireplace", re: /fireplace|hearth|log fire|wood[- ]?burn|open fire/i },
  { slug: "romantic", label: "for a romantic getaway", noun: "romance", re: /romanti|honeymoon|couple|intimate|candle/i },
  { slug: "spa", label: "with a spa", noun: "a spa", re: /\bspa\b|onsen|sauna|hot[- ]?spring|thermal|hammam|soaking tub|hot tub|wellness/i },
  { slug: "boutique", label: "boutique & independent", noun: "boutique character", re: /boutique|independent|design[- ]?led|design hotel|family[- ]?run|owner[- ]?run/i },
  { slug: "views", label: "with a view", noun: "the view", re: /\bview|panoram|overlook|rooftop|sea view|mountain|skyline/i },
];

export function facetBySlug(slug: string): Facet | undefined {
  return FACETS.find((f) => f.slug === slug);
}

// Does a hotel's real signals/description support this facet?
export function matchesFacet(f: Facet, signals: string[] | null | undefined, description: string | null | undefined): boolean {
  const hay = `${(signals || []).join(" ")} ${description || ""}`;
  return f.re.test(hay);
}

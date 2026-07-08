// Traveller Fit — the public, travel-intent taxonomy layered on top of the cosy dataset.
//
// A "concept" is a way a real traveller searches ("quiet hotel in Bruges", "hotel with a
// bathtub in Rome", "dog-friendly cosy stay"). Each concept is inferred per hotel from real
// evidence: guest-review signals, the review-grounded description, and (for physical amenities)
// hotels.amenities. Two layers assign a concept:
//   1. a deterministic regex floor (`re` over signals+description, `amenityRe` over amenities), and
//   2. an LLM pass that can add nuance for SOFT (experiential) concepts.
// HARD concepts are factual/physical claims (a sauna, a pool, a pet policy) that would mislead if
// hallucinated, so they may ONLY be assigned when the deterministic layer actually matches — the
// LLM alone can never grant them.
//
// This mirrors src/lib/facets.ts (the original 5 long-tail facets, which live on as concepts here
// with identical slugs + regex semantics so their indexed URLs keep working). Nothing here exposes
// the internal cosy-scoring machinery — these are outward-facing travel concepts only.

export type FitCategory = "intent" | "style" | "amenity" | "atmosphere" | "location";

export interface TravellerFitConcept {
  /** Stable identifier. Currently equal to `slug`; kept separate so a slug can be reworded later. */
  id: string;
  /** URL segment under /cosy-hotels/ — lowercase-kebab, passes the repo slug guards. */
  slug: string;
  /** Human label used in headings ("Quiet hotels"). */
  label: string;
  /** Noun phrase for inline copy: "cosy hotels {noun}" (mirrors facets.ts). */
  noun: string;
  category: FitCategory;
  /** One-line, traveller-facing explanation. No internal-scoring language. */
  description: string;
  /** Example organic search queries this concept targets. {city} is substituted. */
  seoQueryPatterns: string[];
  /** Example natural-language prompts an AI answer engine might be asked. {city} is substituted. */
  aiPromptPatterns: string[];
  /** LLM confidence floor for a soft assignment to be shown. */
  minConfidence: number;
  /** Whether a /cosy-hotels/{slug}/{city} collection page may be generated for this concept. */
  collectionEnabled: boolean;
  /**
   * "hard" — factual/physical; requires deterministic evidence (re or amenityRe). LLM alone cannot assign.
   * "soft" — experiential/subjective; the LLM may assign above minConfidence even without a regex hit.
   */
  evidence: "hard" | "soft";
  /** Deterministic matcher over `${signals.join(" ")} ${description}` (like facets.ts). */
  re: RegExp;
  /** Deterministic matcher over the joined hotels.amenities array (hard concepts). */
  amenityRe?: RegExp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Concepts. The first five carry over from facets.ts verbatim (slug + regex).
// ─────────────────────────────────────────────────────────────────────────────
export const CONCEPTS: TravellerFitConcept[] = [
  // ── carried over from facets.ts (indexed URLs — slug + regex semantics preserved) ──
  {
    id: "fireplace", slug: "fireplace", label: "Hotels with a fireplace", noun: "with a fireplace",
    category: "atmosphere", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Cosy stays with a real fire: a hearth, wood-burner or open fire to curl up beside.",
    seoQueryPatterns: ["cosy hotels with a fireplace in {city}", "hotels with a log fire in {city}"],
    aiPromptPatterns: ["find me a cosy hotel with a fireplace in {city}", "recommend a hotel in {city} with a real fire for a winter weekend"],
    re: /fireplace|hearth|log fire|wood[- ]?burn|open fire/i,
    amenityRe: /fireplace|wood[- ]?burn/i,
  },
  {
    id: "romantic", slug: "romantic", label: "Romantic hotels", noun: "for a romantic getaway",
    category: "intent", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Intimate, couples-first stays made for a romantic escape or honeymoon.",
    seoQueryPatterns: ["romantic hotels in {city}", "best hotels in {city} for couples"],
    aiPromptPatterns: ["recommend a romantic hotel in {city} for an anniversary", "where should a couple stay in {city} for a romantic weekend"],
    re: /romanti|honeymoon|couples?\b|candle|four[- ]?poster/i,
  },
  {
    id: "spa", slug: "spa", label: "Hotels with a spa", noun: "with a spa",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays with a spa or thermal wellness: somewhere to unwind after the day.",
    seoQueryPatterns: ["hotels with a spa in {city}", "cosy spa hotels in {city}"],
    aiPromptPatterns: ["find a cosy hotel with a spa in {city}", "recommend a wellness hotel in {city} for a relaxing break"],
    re: /\bspa\b|onsen|sauna|hot[- ]?spring|thermal|hammam|soaking tub|hot tub|wellness/i,
    amenityRe: /\bspa\b|sauna|thermal|wellness|hot tub|hammam/i,
  },
  {
    id: "boutique", slug: "boutique", label: "Boutique & independent hotels", noun: "boutique character",
    category: "style", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Small, independent and owner-run hotels with real personality, not chains.",
    seoQueryPatterns: ["boutique hotels in {city}", "independent hotels in {city}"],
    aiPromptPatterns: ["recommend a boutique hotel in {city}", "find a small independent hotel in {city} with character"],
    re: /boutique|independent|design[- ]?led|design hotel|family[- ]?run|owner[- ]?run/i,
  },
  {
    id: "views", slug: "views", label: "Hotels with a view", noun: "the view",
    category: "location", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Stays with a memorable outlook: over rooftops, mountains, a skyline or the water.",
    seoQueryPatterns: ["hotels with a view in {city}", "hotels with the best views in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a great view", "recommend a hotel in {city} with a scenic outlook"],
    re: /\bview|panoram|overlook|rooftop|sea view|mountain|skyline/i,
  },

  // ── intent ──
  {
    id: "quiet", slug: "quiet", label: "Quiet hotels", noun: "for peace and quiet",
    category: "intent", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Calm, restful stays away from noise and crowds, good for a relaxing weekend.",
    seoQueryPatterns: ["quiet hotels in {city}", "peaceful hotels in {city}"],
    aiPromptPatterns: ["recommend a quiet hotel in {city} for a relaxing weekend", "find a peaceful hotel in {city} away from the crowds"],
    re: /\bquiet\b|peaceful|tranquil|serene|secluded|restful|hushed|away from the (crowd|hustle|bustle)|off the beaten/i,
  },
  {
    id: "family-friendly", slug: "family-friendly", label: "Family-friendly hotels", noun: "for families",
    category: "intent", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Welcoming stays that work for families: space, warmth and a relaxed feel with children.",
    seoQueryPatterns: ["family-friendly hotels in {city}", "best hotels in {city} for families"],
    aiPromptPatterns: ["recommend a family-friendly hotel in {city}", "where should a family with kids stay in {city}"],
    re: /famil(y|ies)|kid[- ]?friendly|children welcome|family room|great with kids|connecting rooms?/i,
    amenityRe: /family room|kids?\b|children/i,
  },
  {
    id: "pet-friendly", slug: "pet-friendly", label: "Pet-friendly hotels", noun: "for you and your dog",
    category: "intent", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays that genuinely welcome dogs and pets, not just tolerate them.",
    seoQueryPatterns: ["pet-friendly hotels in {city}", "dog-friendly hotels in {city}"],
    aiPromptPatterns: ["find a dog-friendly hotel in {city}", "recommend a hotel in {city} where I can bring my dog"],
    re: /pet[- ]?friendly|dog[- ]?friendly|dogs? (are )?welcome|pets? (are )?welcome|bring your (dog|pet)/i,
    amenityRe: /pets? allowed|pet[- ]?friendly|dog[- ]?friendly|dogs? allowed/i,
  },

  // ── style ──
  {
    id: "design", slug: "design", label: "Design hotels", noun: "for design lovers",
    category: "style", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Considered, design-forward interiors: architecture and styling you notice and enjoy.",
    seoQueryPatterns: ["design hotels in {city}", "stylish hotels in {city}"],
    aiPromptPatterns: ["recommend a design hotel in {city}", "find a beautifully designed hotel in {city}"],
    re: /design[- ]?(forward|hotel|led)|architectur|minimalist|interior design|mid[- ]?century|scandi(navian)?|beautifully designed|stylish interior/i,
  },
  {
    id: "historic-charm", slug: "historic-charm", label: "Historic hotels", noun: "full of history",
    category: "style", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Buildings with a past: period features, heritage settings and old-world character.",
    seoQueryPatterns: ["historic hotels in {city}", "old-world hotels in {city}"],
    aiPromptPatterns: ["recommend a historic hotel in {city} with character", "find a hotel in {city} in a heritage building"],
    re: /histori|centur(y|ies)|medieval|heritage|listed building|period (feature|propert)|antique|former (palace|monastery|convent|manor|coaching)/i,
  },
  {
    id: "hidden-gem", slug: "hidden-gem", label: "Hidden gems", noun: "off the beaten track",
    category: "style", evidence: "soft", minConfidence: 0.78, collectionEnabled: false,
    description: "Under-the-radar finds that regulars would rather keep to themselves.",
    seoQueryPatterns: ["hidden gem hotels in {city}", "under-the-radar hotels in {city}"],
    aiPromptPatterns: ["find a hidden-gem hotel in {city}", "recommend a lesser-known hotel in {city} that locals love"],
    re: /hidden gem|under[- ]?the[- ]?radar|best[- ]?kept secret|undiscovered|tucked away|well[- ]?kept secret|lesser[- ]?known/i,
  },
  {
    id: "luxury-feel", slug: "luxury-feel", label: "Luxurious hotels", noun: "for a treat",
    category: "style", evidence: "soft", minConfidence: 0.8, collectionEnabled: false,
    description: "Stays that feel indulgent: refined comfort and a sense of occasion.",
    seoQueryPatterns: ["luxury hotels in {city}", "most luxurious hotels in {city}"],
    aiPromptPatterns: ["recommend a luxurious hotel in {city} for a special occasion", "find an indulgent hotel in {city} for a treat"],
    re: /luxur|opulent|sumptuous|lavish|indulgent|refined elegance|five[- ]?star|high[- ]?end|plush/i,
  },
  {
    id: "rustic", slug: "rustic", label: "Rustic retreats", noun: "for a rustic escape",
    category: "style", evidence: "soft", minConfidence: 0.78, collectionEnabled: false,
    description: "Countryside warmth: farmhouses, exposed beams and reclaimed timber.",
    seoQueryPatterns: ["rustic hotels in {city}", "countryside hotels near {city}"],
    aiPromptPatterns: ["find a rustic countryside hotel near {city}", "recommend a farmhouse-style stay near {city}"],
    re: /rustic|farmhouse|converted (barn|mill)|exposed (beam|stone)|reclaimed wood|country(side)? retreat|agriturismo/i,
  },

  // ── amenity (all hard) ──
  {
    id: "great-breakfast", slug: "great-breakfast", label: "Hotels with great breakfast", noun: "for the breakfast",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays where guests single out the breakfast: generous, homemade, a highlight of the stay.",
    seoQueryPatterns: ["hotels with the best breakfast in {city}", "hotels with great breakfast in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with an excellent breakfast", "recommend a hotel in {city} known for its breakfast"],
    re: /(great|excellent|delicious|generous|hearty|fantastic|amazing|lovely|homemade|home[- ]?cooked|superb|wonderful) breakfast|breakfast (was|is)?\s*(great|excellent|delicious|amazing|fantastic|generous|superb|a highlight)|best breakfast/i,
    amenityRe: /breakfast/i,
  },
  {
    id: "sauna", slug: "sauna", label: "Hotels with a sauna", noun: "with a sauna",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays with a sauna or steam room to warm up in.",
    seoQueryPatterns: ["hotels with a sauna in {city}", "cosy hotels with a sauna in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a sauna", "recommend a cosy hotel in {city} with a sauna"],
    re: /\bsauna\b|steam room|finnish sauna/i,
    amenityRe: /sauna|steam room/i,
  },
  {
    id: "bathtub", slug: "bathtub", label: "Hotels with a bathtub", noun: "with a bathtub",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Rooms with a proper bath: a soaking tub or freestanding bath to unwind in.",
    seoQueryPatterns: ["hotels with a bathtub in {city}", "hotels with a freestanding bath in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a bathtub in the room", "recommend a hotel in {city} with a soaking tub"],
    re: /bath[- ]?tub|soaking tub|freestanding bath|roll[- ]?top bath|clawfoot|deep bath/i,
    amenityRe: /bath[- ]?tub|\bbath\b/i,
  },
  {
    id: "rooftop", slug: "rooftop", label: "Hotels with a rooftop", noun: "with a rooftop",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays with a rooftop terrace, bar or garden: a place to take in the view up top.",
    seoQueryPatterns: ["hotels with a rooftop in {city}", "hotels with a rooftop bar in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a rooftop terrace", "recommend a hotel in {city} with a rooftop bar"],
    re: /rooftop|roof terrace|roof[- ]?top bar|roof garden/i,
    amenityRe: /rooftop|roof terrace|roof garden/i,
  },
  {
    id: "garden", slug: "garden", label: "Hotels with a garden", noun: "with a garden",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays with a garden, courtyard or leafy terrace to sit out in.",
    seoQueryPatterns: ["hotels with a garden in {city}", "hotels with a courtyard in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a garden", "recommend a hotel in {city} with a quiet courtyard"],
    re: /\bgarden|courtyard|walled garden|orchard|leafy terrace|patio garden/i,
    amenityRe: /garden|courtyard/i,
  },
  {
    id: "pool", slug: "pool", label: "Hotels with a pool", noun: "with a pool",
    category: "amenity", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    description: "Stays with a swimming pool: indoor, plunge or infinity.",
    seoQueryPatterns: ["hotels with a pool in {city}", "hotels with a swimming pool in {city}"],
    aiPromptPatterns: ["find a hotel in {city} with a pool", "recommend a hotel in {city} with a swimming pool"],
    re: /\bpool\b|swimming pool|plunge pool|infinity pool|indoor pool/i,
    amenityRe: /\bpool\b/i,
  },

  // ── location ──
  {
    id: "christmas-market", slug: "christmas-market", label: "Hotels near the Christmas market", noun: "near the Christmas market",
    category: "location", evidence: "hard", minConfidence: 0.75, collectionEnabled: false,
    description: "Steps from the city's Christmas market: walk to the stalls and lights, then back to somewhere warm.",
    seoQueryPatterns: ["hotels near the christmas market in {city}", "where to stay for the {city} christmas market"],
    aiPromptPatterns: ["recommend a cosy hotel near the {city} christmas market"],
    re: /christmas market|kerstmarkt|weihnachtsmarkt/i,
  },
  {
    id: "walkable", slug: "walkable", label: "Central, walkable hotels", noun: "in a walkable spot",
    category: "location", evidence: "soft", minConfidence: 0.75, collectionEnabled: true,
    description: "Central stays where the good stuff is a short walk away, no taxis needed.",
    seoQueryPatterns: ["central hotels in {city}", "walkable hotels in {city}"],
    aiPromptPatterns: ["find a central hotel in {city} within walking distance of the sights", "recommend a hotel in {city} where I can walk everywhere"],
    re: /steps from|walking distance|walkable|short walk|centrally located|central location|in the heart of|minutes'? walk|stroll to|everything within walk/i,
  },
  {
    id: "waterfront", slug: "waterfront", label: "Waterfront hotels", noun: "by the water",
    category: "location", evidence: "hard", minConfidence: 0.85, collectionEnabled: true,
    // Differentiated from `views` (any scenic outlook): waterfront requires the hotel to actually
    // sit on the water — a factual claim, hence hard evidence.
    description: "Stays right on the water: by the sea, a lake, a harbour or a river.",
    seoQueryPatterns: ["waterfront hotels in {city}", "hotels by the sea in {city}"],
    aiPromptPatterns: ["find a waterfront hotel in {city}", "recommend a hotel in {city} right on the water"],
    re: /waterfront|sea[- ]?front|lake[- ]?front|beach[- ]?front|harbour[- ]?side|harbor[- ]?side|canal[- ]?side|riverside|on the (sea|lake|water)|overlooking the (sea|ocean|lake|harbour|harbor)/i,
    amenityRe: /waterfront|beach[- ]?front|private beach/i,
  },
];

export const CONCEPT_BY_SLUG: Record<string, TravellerFitConcept> = Object.fromEntries(
  CONCEPTS.map((c) => [c.slug, c]),
);

/** The 5 original facets (src/lib/facets.ts) — their indexed URLs keep the historic ≥2 gate. */
export const LEGACY_FACET_SLUGS: ReadonlySet<string> = new Set(["fireplace", "romantic", "spa", "boutique", "views"]);

/**
 * Minimum matching hotels for a city collection page (/cosy-hotels/{slug}/{city}) to exist and be
 * emitted in the sitemap. Legacy facets keep their live ≥2 gate (never de-index a working page);
 * new concepts need ≥5 so we don't mint thin doorway pages.
 */
export function cityCollectionMin(c: TravellerFitConcept): number {
  return LEGACY_FACET_SLUGS.has(c.slug) ? 2 : 5;
}

// ─────────────────────────────────────────────────────────────────────────────
// Matching helpers
// ─────────────────────────────────────────────────────────────────────────────
export interface FitMatchInput {
  signals?: string[] | null;
  description?: string | null;
  amenities?: string[] | null;
}

/** True when a hotel's real text OR amenity evidence supports a concept (deterministic floor). */
export function deterministicMatch(c: TravellerFitConcept, input: FitMatchInput): boolean {
  const hay = `${(input.signals || []).join(" ")} ${input.description || ""}`;
  if (c.re.test(hay)) return true;
  if (c.amenityRe && (input.amenities || []).length) {
    return c.amenityRe.test((input.amenities || []).join(" "));
  }
  return false;
}

/**
 * Guards an assignment against its evidence rule. Soft concepts are always allowed (the LLM may
 * infer them); hard concepts require the deterministic floor to actually match real evidence.
 */
export function hardEvidenceOk(c: TravellerFitConcept, input: FitMatchInput): boolean {
  if (c.evidence === "soft") return true;
  return deterministicMatch(c, input);
}

export interface TravellerFitAssignment {
  hotel_id: string;
  concept_id: string;
  confidence: number;
  evidence_text: string;
  source: "llm" | "rule";
}

/**
 * Pick the concepts to show on a hotel page. Keeps assignments at/above each concept's
 * minConfidence, orders by confidence desc, and favours variety — at most 2 per category until the
 * cap is reached, then backfills with the strongest leftovers. Stable for equal confidences.
 */
export function displayFits(assignments: TravellerFitAssignment[], max = 6): TravellerFitAssignment[] {
  const eligible = assignments
    .filter((a) => {
      const c = CONCEPT_BY_SLUG[a.concept_id];
      return c != null && a.confidence >= c.minConfidence;
    })
    .sort((a, b) => b.confidence - a.confidence);

  const perCategory = new Map<FitCategory, number>();
  const picked: TravellerFitAssignment[] = [];
  const overflow: TravellerFitAssignment[] = [];

  for (const a of eligible) {
    const c = CONCEPT_BY_SLUG[a.concept_id];
    const used = perCategory.get(c.category) ?? 0;
    if (used < 2) {
      picked.push(a);
      perCategory.set(c.category, used + 1);
      if (picked.length >= max) break;
    } else {
      overflow.push(a);
    }
  }
  for (const a of overflow) {
    if (picked.length >= max) break;
    picked.push(a);
  }
  return picked.slice(0, max);
}

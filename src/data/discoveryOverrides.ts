// Discovery presentation overrides — DIE Bruges 001, founder-approved 2026-07-05.
// Pattern per die-validation D-0002: keyed maps merged at render; delete an entry (or this
// file plus its call-site hooks) to restore the templated defaults. Never touches truth data.

// R11 — per-city guide-page title (guides/[slug] generateMetadata).
export const CITY_TITLE: Record<string, string> = {
  Bruges: "Cosy Boutique Hotels & B&Bs in Bruges — AI-ranked",
  Charleston: "Cosy Boutique Hotels & Historic Inns in Charleston — AI-ranked",
};

// R9 — per-city lead sentence, prepended to the data-derived intro (which stays, for honesty).
export const CITY_INTRO_LEAD: Record<string, string> = {
  Bruges:
    "Bruges does cosy its own way: 17th-century townhouses, canal-side B&Bs and small family-run guesthouses inside the old walls — not chain hotels.",
  Charleston:
    "Charleston does cosy as historic inns and B&Bs — 19th-century single houses, courtyard inns and harbor-view guesthouses in the walkable historic core, not chain hotels.",
};

// R4 + R6 — per-city extra FAQs, appended to the templated cityFaqs() (rendered + FAQPage JSON-LD).
export const CITY_EXTRA_FAQS: Record<string, Array<{ q: string; a: string }>> = {
  Bruges: [
    {
      q: "Where should I stay for the Bruges Christmas Market?",
      a: "The market is held on the Grote Markt in the heart of the old centre. Stay anywhere inside the 'egg' of Bruges and you can walk over in minutes — we've scored 51 cosy hotels within 600 m of the square. See our guide to cosy hotels near the Bruges Christmas Market for the full ranked list.",
    },
    {
      q: "Is Bruges or Brussels better for Christmas markets?",
      a: "They're different trips. Bruges is compact and atmospheric — a small market on a medieval square, canals and cobbles, everything walkable from a cosy hotel. Brussels is bigger: a larger market plus the Grand-Place light show, with more big-city hotels. For a cosy weekend built around the market itself, Bruges is the stronger pick.",
    },
    {
      q: "Is one night in Bruges enough?",
      a: "One night beats a day trip: the centre's highlights are walkable in a day, and the evening after the day-trippers leave is when Bruges is at its cosiest. Pick a small hotel inside the old centre and you'll see the best of it in 24 hours.",
    },
  ],
  Charleston: [
    {
      q: "Historic District or Mount Pleasant — where should I stay in Charleston?",
      a: "For a cosy, walkable stay, the Historic District (downtown) is the pick — King Street, the City Market, the French Quarter and the waterfront are all on foot, so you won't need a car in the city. Mount Pleasant is a quieter suburb across the Cooper River, better if you have a car and want more space. Our curated cosy hotels are in the walkable historic core.",
    },
    {
      q: "Where should I stay in Charleston for a romantic weekend?",
      a: "Charleston is built for it: courtyard inns and historic B&Bs on quiet cobbled streets, walkable to candlelit restaurants and the waterfront at Battery Park. Stay in the Historic District and the whole evening is on foot. See our ranked cosy hotels near the Historic District for the shortlist.",
    },
  ],
};

// R13 (founder-edited) — per facet-city title/intro override, keyed "facet/citySlug".
// Language verified in traveler forum answers: "close to the Grote Markt but removed enough
// to be nice and quiet" — promise night-noise relief + micro-location, never "soundproofed".
export const FACET_CITY_COPY: Record<string, { title?: string; intro?: string }> = {
  "quiet/bruges": {
    title: "Quiet Hotels near the Centre of Bruges — sleep well, steps from the Markt",
    intro:
      "Travellers asking about Bruges keep wanting the same thing: near the centre, but quiet at night. These hotels sit inside the old town within walking distance of the Grote Markt, on the quieter streets — guests consistently mention peaceful sleep and low street noise. Ranked by cosy score.",
  },
};

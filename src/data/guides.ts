// Curated (hand-written) guides. `body` is narrative HTML ONLY — editorial prose, no hotel
// names, no scores, no distances baked in. Every hotel is a live pick resolved at request time by
// `resolveCuratedPicks` (src/lib/seo/guidePicks.ts) from the hotel's `slug`, so name/city/country/
// score/image/description/website always match the current cosy_scores row (the #44 rule:
// src/lib/blogPickScores.ts's module comment). `note` is the one per-hotel editorial fact worth
// keeping that ISN'T a score (e.g. a measured distance) — everything else renders live via the
// shared HotelCard. Below-gate picks (score < 5.0) drop silently; see COSY_FLOOR in guidePicks.ts.
export type GuidePick = { slug: string; note?: string };

export type Guide = {
  slug: string;
  title: string;
  excerpt: string;
  body: string; // simple HTML string for MVP — narrative only, no embedded hotel lists/scores
  picks: GuidePick[];
  /** Heading shown above the live HotelCard picks list, translated like every other section
   *  heading on this page (established pattern: guides/[slug]/page.tsx's LC object). */
  picksHeading: string;
};

export const guides: Guide[] = [
  {
    slug: "cosy-hotels-near-bruges-christmas-market",
    title: "Where to Stay for the Bruges Christmas Market, 51 Cosy Hotels within 600 m",
    excerpt: "The Bruges Christmas Market is on the Grote Markt. These 51 AI-scored cosy hotels are all within 600 m, walking distance on a December evening, ranked by cosy score.",
    body: "<p>The Bruges Christmas Market is held on the <strong>Grote Markt</strong>, the medieval square at the heart of the old centre. The whole market experience, stalls, lights, the ice rink years it runs, happens within a few cobbled streets, so where you sleep decides how much of it you get: staying inside the old walls means gluhwein to hotel door in minutes, in the cold, without a taxi.</p>\n<p>Every hotel below is <strong>within 600 metres of the Grote Markt</strong>, comfortable walking distance on a December evening, and each carries our AI cosy score (0–10 for warmth, character and intimacy), ranked best first. Many are exactly the 17th-century townhouses and family-run B&amp;Bs <a href=\"/en/guides/bruges-cosy-hotel\">Bruges does best</a>; several sit near the Markt or towards &#39;t Zand.</p>\n<h2>Good to know</h2>\n<p>The market usually runs from late November to early January. Book early: the old centre is small and the cosiest houses have few rooms. If you want the same area without the market-season prices, many of these hotels run winter midweek offers. Browse more: <a href=\"/en/cosy-hotels/boutique/bruges\">boutique hotels in Bruges</a> · <a href=\"/en/cosy-hotels/walkable/bruges\">central, walkable Bruges hotels</a> · <a href=\"/en/cosy-hotels/quiet/bruges\">quiet hotels near the centre</a>.</p>",
    picksHeading: "The cosiest hotels near the Christmas Market",
    picks: [
      { slug: "belgium-bruges-boutique-bandb-everelmus", note: "320 m from the Grote Markt" },
      { slug: "the-herring-s-residence", note: "477 m from the Grote Markt" },
      { slug: "huis-koning-b-b", note: "452 m from the Grote Markt" },
      { slug: "belgium-bruges-nuit-blanche", note: "402 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-bonifacius", note: "413 m from the Grote Markt" },
      { slug: "relais-bourgondisch-cruyce", note: "193 m from the Grote Markt" },
      { slug: "belgium-bruges-number-11-exclusive-guesthouse", note: "391 m from the Grote Markt" },
      { slug: "belgium-bruges-guesthouse-mirabel", note: "432 m from the Grote Markt" },
      { slug: "belgium-bruges-die-swaene-hotel", note: "288 m from the Grote Markt" },
      { slug: "speelmansrei", note: "390 m from the Grote Markt" },
      { slug: "belgium-bruges-the-secret-garden-luxury-suites", note: "448 m from the Grote Markt" },
      { slug: "belgium-bruges-huis-t-schaep", note: "512 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-van-cleef", note: "548 m from the Grote Markt" },
      { slug: "belgium-bruges-the-burgundy-boutique-bandb", note: "379 m from the Grote Markt" },
      { slug: "belgium-bruges-bed-and-breakfast-canal-deluxe", note: "423 m from the Grote Markt" },
      { slug: "belgium-bruges-bandb-ambrogio-brugge", note: "554 m from the Grote Markt" },
      { slug: "belgium-bruges-b-guest-bed-and-breakfast", note: "498 m from the Grote Markt" },
      { slug: "the-secret-garden", note: "445 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-malleberg", note: "252 m from the Grote Markt" },
      { slug: "belgium-bruges-boutique-hotel-le-foulage", note: "533 m from the Grote Markt" },
      { slug: "heritage-hotel-bruges", note: "178 m from the Grote Markt" },
      { slug: "belgium-bruges-charming-guesthouse-pand-17", note: "277 m from the Grote Markt" },
      { slug: "belgium-bruges-patritius-bvba", note: "361 m from the Grote Markt" },
      { slug: "hotel-heritage-relais-and-chateaux", note: "179 m from the Grote Markt" },
      { slug: "hotel-de-castillon", note: "376 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-salvators-and-co-cv", note: "461 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-alegria", note: "262 m from the Grote Markt" },
      { slug: "belgium-bruges-boterhuis", note: "320 m from the Grote Markt" },
      { slug: "belgium-bruges-martins-relais", note: "413 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-jan-brito", note: "379 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-dukes-arches", note: "358 m from the Grote Markt" },
      { slug: "belgium-bruges-boutique-hotel-sablon", note: "255 m from the Grote Markt" },
      { slug: "belgium-bruges-bandb-de-bornedrager", note: "407 m from the Grote Markt" },
      { slug: "b-b-calis", note: "206 m from the Grote Markt" },
      { slug: "hotel-bla-bla", note: "464 m from the Grote Markt" },
      { slug: "belgium-bruges-luxury-boutique-hotel-de-castillion", note: "387 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-dukes-palace", note: "313 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-aragon", note: "287 m from the Grote Markt" },
      { slug: "belgium-bruges-casa-romantico", note: "404 m from the Grote Markt" },
      { slug: "the-black-swan-hotel", note: "370 m from the Grote Markt" },
      { slug: "belgium-bruges-martins-brugge", note: "122 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-ter-brughe", note: "557 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-navarra-brugge", note: "312 m from the Grote Markt" },
      { slug: "belgium-bruges-grand-hotel-casselbergh", note: "282 m from the Grote Markt" },
      { slug: "belgium-bruges-calis-brugge", note: "219 m from the Grote Markt" },
      { slug: "portinari", note: "541 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-notre-dame", note: "295 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-acacia", note: "175 m from the Grote Markt" },
      { slug: "passage", note: "454 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-montanus", note: "588 m from the Grote Markt" },
      { slug: "house-of-bruges", note: "232 m from the Grote Markt" },
    ],
  },
  {
    slug: "bruges-vs-ghent-cosy-weekend",
    title: "Bruges or Ghent for a Cosy Weekend? An Honest Comparison",
    excerpt: "Both are walkable medieval cities an hour apart. Which suits a cosy weekend, and is one night in Bruges enough? Honest answer, with the top cosy-scored hotels in each.",
    body: "<p>It's the most-asked question in Belgium trip planning: <strong>Bruges or Ghent, and is one night enough?</strong> Short honest answer: they're both walkable medieval cities an hour apart, and for a <em>cosy</em> weekend they play different roles.</p>\n<h2>Bruges: the cosy classic</h2>\n<p>Bruges is smaller, more preserved and more romantic: canals, cobbles and gabled townhouses, with the famous Christmas market on the Grote Markt in winter. It's busy with day-trippers, but the evenings after they leave are exactly when a small hotel inside the old walls pays off. One night is genuinely enough to see the centre; it's the night itself that makes it.</p>\n<h2>Ghent: livelier, cheaper, fewer crowds</h2>\n<p>Ghent is a bigger, living city: a university town with grittier edges, great food and the same canal-and-towers beauty with far fewer tour groups. Hotels tend to cost less for the same character.</p>\n<h2>The verdict</h2>\n<p>First time in Belgium, one night, winter: <strong>Bruges</strong>, especially <a href=\"/en/guides/cosy-hotels-near-bruges-christmas-market\">near the Christmas market</a>. Second visit, or you want evenings with locals rather than day-trippers: <strong>Ghent</strong>. Doing both is easy: they're 25 minutes apart by train; sleep in one, day-trip the other. More: <a href=\"/en/guides/bruges-cosy-hotel\">all cosy Bruges hotels</a> · <a href=\"/en/guides/ghent-cosy-hotel\">all cosy Ghent hotels</a>.</p>",
    picksHeading: "Top cosy picks in each city",
    picks: [
      { slug: "belgium-bruges-boutique-bandb-everelmus", note: "Bruges · 320 m from the Grote Markt" },
      { slug: "the-herring-s-residence", note: "Bruges · 477 m from the Grote Markt" },
      { slug: "huis-koning-b-b", note: "Bruges · 452 m from the Grote Markt" },
      { slug: "belgium-bruges-nuit-blanche", note: "Bruges · 402 m from the Grote Markt" },
      { slug: "belgium-bruges-hotel-bonifacius", note: "Bruges · 413 m from the Grote Markt" },
      { slug: "eremyten-hof", note: "Ghent" },
      { slug: "villa-emma", note: "Ghent" },
      { slug: "belgium-ghent-1898-the-post", note: "Ghent" },
      { slug: "the-boatel", note: "Ghent" },
      { slug: "petit-prince", note: "Ghent" },
    ],
  },
  {
    slug: "cosy-hotels-charleston-historic-district",
    title: "Where to Stay near Charleston's Historic District, 25 Cosy Hotels within 1.5 km of King Street",
    excerpt: "King Street and the Historic District are walkable Charleston. These 25 AI-scored cosy hotels, historic inns and B&amp;Bs, are all within 1.5 km, ranked by cosy score.",
    body: "<p>King Street and the Historic District are the heart of walkable Charleston, the shops, the City Market, the French Quarter and the waterfront are all on foot from here. Where you sleep decides how much of it you get without a car.</p>\n<p>Every hotel below is <strong>within 1.5 km of King Street</strong>, walkable to the market, the restaurants and the French Quarter, and each carries our AI cosy score (0–10 for warmth, character and intimacy), ranked best first. Charleston does cosy as historic inns and B&amp;Bs, many of these are 19th-century single houses and courtyard inns rather than chain hotels.</p>\n<h2>Good to know</h2>\n<p>Charleston is famously walkable in the historic core, so a central stay means no rental car for the city itself (you'll still want one for day trips to the plantations or the beaches). For the neighbourhood question travellers ask most, Historic District or Mount Pleasant, the downtown historic core is the cosy, walkable pick; browse more on our <a href=\"/en/cosy-hotels/boutique/charleston\">Charleston hotels page</a>.</p>",
    picksHeading: "The cosiest hotels near the Historic District",
    picks: [
      { slug: "15-church-street-bed-breakfast", note: "1.14 km from King Street" },
      { slug: "sc-29401-the-jasmine-house-2", note: "0.66 km from King Street" },
      { slug: "sc-29401-the-loutrel-2", note: "0.8 km from King Street" },
      { slug: "wentworth-mansion", note: "0.27 km from King Street" },
      { slug: "the-charlee-on-cannon", note: "1.38 km from King Street" },
      { slug: "the-governor-s-house-inn", note: "0.5 km from King Street" },
      { slug: "sc-29401-the-spectator-hotel", note: "0.79 km from King Street" },
      { slug: "22-charlotte", note: "1.27 km from King Street" },
      { slug: "sc-29401-the-vendue-charlestons-art-hotel-2", note: "0.98 km from King Street" },
      { slug: "sc-29401-planters-inn-2", note: "0.56 km from King Street" },
      { slug: "sc-29401-bijou-boutique-inn-2", note: "0.83 km from King Street" },
      { slug: "sc-29401-zero-george", note: "1.05 km from King Street" },
      { slug: "sc-29401-the-barksdale-house-inn-2", note: "0.61 km from King Street" },
      { slug: "french-quarter-inn", note: "0.74 km from King Street" },
      { slug: "sc-29401-the-ansonborough-2", note: "0.96 km from King Street" },
      { slug: "sc-29403-hotel-bennett-2", note: "0.86 km from King Street" },
      { slug: "sc-29401-market-pavilion-hotel", note: "0.91 km from King Street" },
      { slug: "sc-29401-the-restoration-charleston", note: "0.38 km from King Street" },
      { slug: "sc-29403-the-dewberry-charleston-2", note: "0.99 km from King Street" },
      { slug: "the-rutledge-avenue-inn", note: "1.32 km from King Street" },
      { slug: "bee-blossom-historic-charm", note: "1.2 km from King Street" },
      { slug: "sc-29401-the-pinch-charleston", note: "0.57 km from King Street" },
      { slug: "sc-29401-the-charleston-place-2", note: "0.5 km from King Street" },
      { slug: "sc-29401-grand-bohemian-charleston-autograph-collection-2", note: "0.58 km from King Street" },
      { slug: "country-victorian", note: "0.72 km from King Street" },
    ],
  },
];

export function getGuide(slug: string) {
  return guides.find((g) => g.slug === slug);
}

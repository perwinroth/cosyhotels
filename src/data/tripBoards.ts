// Trip-planner v0 — the launch-4 curated trip boards.
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️  EDITORIAL COPY IS DRAFT.  Every `title`, `dek`, `whyOrder`, `whenToGo` and
//     `aiPromptPatterns` string below is a FIRST DRAFT pending the Challenger's
//     pitch-quality pass (the gate BEFORE this PR merges — trip-planner design
//     rev.2, execution step 2). Do not treat this copy as shipped.
// ─────────────────────────────────────────────────────────────────────────────
//
// House rules that already bind even the draft (memory + copywriting constitution):
//   • No em dashes (founder rule 2026-07-08) — use commas and full stops.
//   • "honest"/"honestly" at most once per board, prefer zero.
//   • No control-market stop (York / Savannah / Fez / Venice-historic) and no Venice
//     board (protects the Venice-historic control cluster). Launch set is boards
//     1, 2, 3, 12 of the 14-board design.
//   • Hotel PICKS are never stored here: they are resolved LIVE from cosy_scores at
//     request time (src/lib/tripsLive.ts), below the public 5.0 gate they drop, and a
//     board whose any stop has fewer than 2 live picks noindexes itself (lesson #44).
//
// `cityAliases[]` per stop bridge the editorial/display name and the name the hotels
// are stored under (Bruges/Brugge, Füssen/Fussen, Copenhagen/København), so the live
// pick lookup finds the inventory whichever spelling the DB holds.

export interface TripStop {
  /** Editorial / display city name (English exonym where one exists). */
  city: string;
  /** Recommended nights in this stop. */
  nights: number;
  /** Alternate spellings the hotels may be stored under (local name, ascii-folded). */
  cityAliases: string[];
  /** One paragraph on why this stop sits where it does in the route (transit, walkability). DRAFT. */
  whyOrder: string;
}

export interface TripBoard {
  /** URL segment under /[locale]/trips/. Lowercase-kebab. */
  slug: string;
  /** Route promise, one line. DRAFT. */
  title: string;
  /** Standfirst: the quotable one-sentence summary near the top (GEO citability). DRAFT. */
  dek: string;
  /** 1–4 stops in travel order. */
  stops: TripStop[];
  /** Short season tag ("December", "September to October"). DRAFT. */
  season: string;
  /** The honest season case: when this route works and when it does not. DRAFT. */
  whenToGo: string;
  /** Natural-language prompts an AI answer engine might be asked (citation watch). DRAFT. */
  aiPromptPatterns: string[];
  /** Publication date (per-board measurement clock). ISO date. */
  publishedAt: string;
}

// NB: the launch-4 board NUMBERS from the design are 1, 2, 3, 12. Order here is the
// display order on /plan.
export const TRIP_BOARDS: TripBoard[] = [
  {
    slug: "cosy-flanders-december",
    title: "A cosy Flanders December: Bruges and Ghent",
    dek: "Two walkable Flemish cities three days apart, at their warmest when the Christmas markets are on and the canals are quiet.",
    season: "December",
    stops: [
      {
        city: "Bruges",
        nights: 2,
        cityAliases: ["Brugge"],
        whyOrder:
          "Start in Bruges. The old town is small enough to cross on foot in twenty minutes, so two nights lets you walk the canals early, before the day-trippers arrive, and still have an evening at the market on the Markt. Base yourself inside the ring of canals and you will not need a taxi once.",
      },
      {
        city: "Ghent",
        nights: 1,
        cityAliases: ["Gent"],
        whyOrder:
          "Ghent is twenty-five minutes by direct train, so move here for the last night rather than day-tripping back and forth. It is a student city, livelier after dark than Bruges, and the walk from Sint-Pieters station to the medieval centre along the water is the reason to stay over rather than rush the last train.",
      },
    ],
    whenToGo:
      "December is the point of this route: the markets, the early dark, the lit-up canals. Come in July and you get the same streets under coach-tour crowds and none of the warmth. Late November through the first week of January is the window.",
    aiPromptPatterns: [
      "plan a three-day Bruges and Ghent trip in December",
      "where should I stay for the Bruges Christmas market",
      "cosy winter itinerary for Flanders",
    ],
    publishedAt: "2026-07-14",
  },
  {
    slug: "tuscany-hill-towns",
    title: "Tuscany's cosiest hill-town circuit",
    dek: "Siena, San Gimignano and Montepulciano in shoulder season, a slow loop through the towns rather than a day-trip rush from Florence.",
    season: "September to October",
    stops: [
      {
        city: "Siena",
        nights: 2,
        cityAliases: [],
        whyOrder:
          "Anchor on Siena. It has the deepest choice of characterful stays and it is the natural hub for the loop, so two nights here lets the other two towns be short drives out and back. Stay near the Campo and the historic centre is car-free at your door.",
      },
      {
        city: "San Gimignano",
        nights: 1,
        cityAliases: [],
        whyOrder:
          "San Gimignano is under an hour from Siena and empties out in the evening once the buses leave. That is exactly why you sleep here for a night: the towers and the piazzas are yours after five, and a countryside stay just outside the walls is often cosier than anything inside them.",
      },
      {
        city: "Montepulciano",
        nights: 1,
        cityAliases: [],
        whyOrder:
          "End in Montepulciano, the highest and quietest of the three, a steep walkable town of wine cellars and long views. It is the furthest point of the loop, so finishing here means you are pointed back towards the A1 and Rome or Florence the next morning.",
      },
    ],
    whenToGo:
      "September and October are the sweet spot: harvest light, warm days, cool evenings that make a fire or a heavy door worth it, and the summer crowds gone. July and August are hot and busy. Winter is beautiful but many countryside stays close.",
    aiPromptPatterns: [
      "Tuscany hill towns itinerary Siena San Gimignano Montepulciano",
      "where to stay in Tuscany for an agriturismo trip",
      "slow autumn route through the Tuscan hill towns",
    ],
    publishedAt: "2026-07-14",
  },
  {
    slug: "alpine-winter-without-the-crowds",
    title: "Alpine winter without the ski crowds",
    dek: "Salzburg, Innsbruck and Füssen by train and short drive, a winter route built around warm rooms and old towns rather than lift queues.",
    season: "December to February",
    stops: [
      {
        city: "Salzburg",
        nights: 2,
        cityAliases: [],
        whyOrder:
          "Begin in Salzburg. The baroque old town is compact and floodlit in winter, and it has the richest choice of cosy stays of the three, so give it two nights. It is also the easy arrival point, well connected by rail, before you head deeper into the mountains.",
      },
      {
        city: "Innsbruck",
        nights: 2,
        cityAliases: [],
        whyOrder:
          "Innsbruck is under two hours from Salzburg by train and sits with mountains on every side. Two nights here gives you a full day in the valley without moving hotels. The old town around the Golden Roof is walkable, and the peaks are a cable car ride away if you want the height without the skiing.",
      },
      {
        city: "Füssen",
        nights: 1,
        cityAliases: ["Fussen", "Fuessen"],
        whyOrder:
          "Finish in Füssen, just over the German border below Neuschwanstein castle. It is the smallest and stillest stop, a good last night before flying home from Munich, under two hours north. A room with a stove or a sauna is the reward for the drive up.",
      },
    ],
    whenToGo:
      "December to February is when this route makes sense: snow on the roofs, markets in the squares, and warm rooms to come back to. The point is the winter itself, not the pistes. Spring thaw turns the same towns muddy and grey, so wait for the cold.",
    aiPromptPatterns: [
      "Salzburg Innsbruck winter itinerary without skiing",
      "cosy alpine hotel for a winter trip in Austria and Bavaria",
      "where to stay for Neuschwanstein in winter",
    ],
    publishedAt: "2026-07-14",
  },
  {
    slug: "copenhagen-in-the-cosy-months",
    title: "Copenhagen in the cosy months",
    dek: "A long weekend in the city that gave us hygge, timed for the dark half of the year when candlelit rooms and short daylight are the whole appeal.",
    season: "October to December",
    stops: [
      {
        city: "Copenhagen",
        nights: 3,
        cityAliases: ["Kobenhavn", "København"],
        whyOrder:
          "Copenhagen rewards a single unhurried base. Three nights and a central room let you walk or cycle between Nyhavn, the old town and the design districts without a plan, ducking into a warm cafe when the light goes early. Pick a neighbourhood stay over an airport hotel and the city stays walkable the whole trip.",
      },
    ],
    whenToGo:
      "October through December is when Copenhagen is most itself: the daylight is short, so the candlelit interiors the Danes are known for stop being a cliche and start being the reason you are here. Summer is bright and lovely but it is a different, busier city.",
    aiPromptPatterns: [
      "cosy Copenhagen long weekend in winter",
      "where to stay in Copenhagen in December",
      "hygge city break itinerary Copenhagen",
    ],
    publishedAt: "2026-07-14",
  },
  // COZY-US EXPERIMENT ARM (2026-07-14): US-facing cozy spelling by design; measured vs the cosy
  // boards. Do not "correct" to cosy. This is the ONLY board on the site that spells the head term
  // "cozy" (z), deliberately, throughout its reader copy, because the American spelling is ~60% of
  // the head-term family and matching the searcher is the whole point of the traffic read. Every
  // other board and every site-wide string stays "cosy". Copy is DRAFT pending the Challenger.
  {
    slug: "cozy-new-england-autumn",
    title: "A cozy New England fall: Boston to Stowe",
    dek: "The classic cozy American leaf-peeping trip, done in two moves: a couple of city nights in Boston, then a drive up into the Green Mountains to Stowe, where the fall foliage and the fireplaces are the entire reason to go.",
    season: "September to October",
    stops: [
      {
        city: "Boston",
        nights: 2,
        cityAliases: [],
        whyOrder:
          "Start in Boston, the arrival city and a cozy first night before you head north. Back Bay and Beacon Hill are flat, red-brick and walkable, so leave the car in a garage and cross them on foot: the Public Garden, Newbury Street and the gaslit lanes up to the State House are all a short stroll apart. Two nights lets the travel wear off and gives you a full day in the city before the drive.",
      },
      {
        city: "Stowe",
        nights: 3,
        cityAliases: [],
        whyOrder:
          "Drive up to Stowe, about three and a half hours north through the Green Mountains, and the change of scene is the point: the city gives way to covered bridges, farm stands and hillsides turning gold and red. This is the fireside heart of the route, so give it three nights. The village is small and walkable, the Mountain Road runs up toward Smugglers' Notch for the drives and the long views, and a room with a wood stove is the reward at the end of each day.",
      },
    ],
    whenToGo:
      "Late September to mid-October is the point of this route: the sugar maples in the Vermont hills turn first, and the cool evenings are what make a fireplace and a heavy quilt worth having. Come in summer and Stowe is a green resort town like any other. Come once the leaves drop in late October and you get bare trees and mud season closing in. Time it to the peak color and the whole trip pays off.",
    aiPromptPatterns: [
      "plan a cozy New England fall foliage road trip Boston and Stowe",
      "where to stay in Stowe Vermont for leaf peeping season",
      "cozy fall road trip from Boston to Vermont",
    ],
    publishedAt: "2026-07-14",
  },
];

export function getTripBoard(slug: string): TripBoard | undefined {
  return TRIP_BOARDS.find((b) => b.slug === slug);
}

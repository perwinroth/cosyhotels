// SINGLE source of truth for city exonyms (local ⇄ English). Consumed by BOTH:
//   • placeText.displayCity — folded local name → the English exonym shown site-wide
//   • cityHotels (CITY_DB_ALIAS) — folded incoming name → the DB match string the accent-folding
//     RPC needs, so an English (or Swedish, …) slug finds hotels stored under the local spelling.
// Keeping one list means the display exonym and the match alias can never drift apart.
//
// INVARIANT: a `match` needle must only ADD matches (strict superset). The RPC does a single
// unaccent(city) LIKE '%unaccent(q)%', so a needle that redirects to ONE spelling would DROP the
// other — only add a needle that is a common substring catching every stored spelling, verified
// against the DB (never pulls in an unrelated city). Where no such substring exists (Prague/Praha
// share only "pra", which also hits Praiano/Prabang/Pradesh), leave `match` off and report it.

export type ExonymEntry = {
  english: string;   // what we DISPLAY (the English exonym)
  local: string[];   // native/local spellings as stored in the DB `city` column
  match?: string;    // RPC needle unioning every stored spelling. Omit when accent-folding already
                     // covers it (Istanbul/İstanbul) or no safe common substring exists (Prague).
};

// Verified against the live DB (score ≥ 5) on 2026-07-05. Counts noted where a needle unions a
// split city (both spellings stored). Most major exonym cities are ALREADY stored in English
// (Rome/Venice/Florence/Vienna/Munich/Cologne/Seville/Copenhagen/Lisbon), so they need display
// keys only in case a local row appears — no match needle.
const ENTRIES: ExonymEntry[] = [
  // Split city, DB stores both "Prague" (30) and "Praha*" (78). No safe common substring
  // ("pra" also matches Praiano/Luang Prabang/Uttar Pradesh), so NO match needle: the English
  // slug keeps matching the 30 "Prague" rows (still ≥3, so the guide gates + sitemaps unchanged).
  { english: "Prague", local: ["Praha", "Praga"] },
  { english: "Florence", local: ["Firenze"] },
  { english: "Venice", local: ["Venezia"] },
  { english: "Rome", local: ["Roma"] },
  { english: "Milan", local: ["Milano"] },
  { english: "Turin", local: ["Torino"] },
  { english: "Naples", local: ["Napoli"] },
  { english: "Genoa", local: ["Genova"] },
  { english: "Cologne", local: ["Köln"] },
  { english: "Munich", local: ["München"] },
  { english: "Vienna", local: ["Wien", "Wien-Innere Stadt"] },
  { english: "Seville", local: ["Sevilla"] },
  { english: "Brussels", local: ["Bruxelles", "Brussel"] },
  { english: "Copenhagen", local: ["København"] },
  { english: "Lisbon", local: ["Lisboa"] },
  { english: "Reykjavik", local: ["Reykjavík"] },
  { english: "Bangkok", local: ["Krung Thep Maha Nakhon"] },
  { english: "Athens", local: ["Athína", "Athina"] },
  // Local form actually stored — needs a match needle so the English slug finds it.
  // Split city Bruges (27) + Brugge (60); "brug" unions both, matches no other DB city.
  { english: "Bruges", local: ["Brugge"], match: "brug" },
  // Luzern (22) dominant; "Lucerne" (1) can't be unioned (no clean common substring), so the
  // needle picks the 22 — mirrors the pre-existing lucerne→Luzern alias.
  { english: "Lucerne", local: ["Luzern"], match: "Luzern" },
  // DB stores the ENGLISH "Gothenburg" (2); the Swedish slug maps onto it.
  { english: "Gothenburg", local: ["Göteborg", "Goteborg"], match: "Gothenburg" },
];

// Fold used to compare an incoming/stored name against an entry's spellings. Mirrors the shape of
// cityHotels.foldCity (NFD accent strip + special letters + lowercase). cityHotels builds its RPC
// alias with ITS OWN foldCity for exact Postgres-unaccent parity; this fold is only for grouping.
function fold(s: string): string {
  return (s || "")
    .replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/œ/gi, "oe")
    .replace(/ß/g, "ss").replace(/[đð]/gi, "d").replace(/ł/gi, "l").replace(/þ/gi, "th")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().trim();
}

// Display map: folded-lower local spelling → English exonym. placeText.displayCity looks up by
// `t.toLowerCase()` (diacritics preserved), so key on toLowerCase (NOT fold) for a faithful match.
export const EXONYM_DISPLAY: Record<string, string> = Object.fromEntries(
  ENTRIES.flatMap((e) => e.local.map((l) => [l.toLowerCase(), e.english] as const)),
);

/** The canonical entries, for cityHotels to derive its RPC alias with its own foldCity. */
export const EXONYMS: ReadonlyArray<ExonymEntry> = ENTRIES;

/**
 * Every DB spelling to OR-match for a city (english + locals), given any incoming spelling. Used by
 * the guide page's ilike query (accent-sensitive), so it can find e.g. "Gothenburg" rows from a
 * "Goteborg" slug. Returns [] when the name isn't a known exonym.
 */
export function cityExonymVariants(name: string): string[] {
  const key = fold(name);
  for (const e of ENTRIES) {
    if (fold(e.english) === key || e.local.some((l) => fold(l) === key)) {
      return [e.english, ...e.local];
    }
  }
  return [];
}

// SINGLE source of truth for "which cosy hotels are in a city", shared by the /cosy-hotels/[facet]/
// [city] page and the sitemap. Previously the page applied dedup-by-name + isLatin() + an ilike city
// match that the sitemap's raw count skipped, so the sitemap listed (facet, city) URLs the page then
// 404'd (21 such URLs in GSC "Crawled – not indexed"). Now BOTH derive membership from the same pure
// predicate (cityMembers) — the page fetches its rows via ilike, the sitemap filters an in-memory
// scan — so their counts can never disagree, and neither needs a per-city round-trip.
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { EXONYMS } from "@/lib/exonyms";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { matchesFacet, facetBySlug, type Facet } from "@/lib/facets";
import {
  CONCEPTS, CONCEPT_BY_SLUG, LEGACY_FACET_SLUGS,
  type TravellerFitConcept,
} from "@/lib/travellerFit";

export type CityCosyHotel = {
  id: string; slug: string; name: string; city: string; country: string;
  score: number; snippet: string; signals: string[] | null; description: string | null;
  lat: number | null; lng: number | null;
};

// Row shape returned by CITY_HOTEL_SELECT. Used by both the page fetch and the sitemap scan.
export type ScoreHotelRow = {
  hotel_id: string; score: number | null; score_final: number | null;
  signals: string[] | null; description: string | null;
  hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat?: number | null; lng?: number | null } | null;
};

// Keep the page fetch and the sitemap scan selecting IDENTICAL columns.
export const CITY_HOTEL_SELECT =
  "hotel_id, score, score_final, signals, description, hotel:hotel_id!inner(slug, name, name_en, city, country, lat, lng)";

/** Recover a display city name from a city slug (known cities first, else prettified slug). */
export function resolveCity(slug: string): string {
  return cityFromSlug(`${slug}-cosy-hotel`) || slug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

// Accent + special-letter fold, mirroring Postgres unaccent() (which the SQL side uses) so the
// in-memory match agrees with the DB match. NFD strips combining accents; the explicit map covers
// letters NFD leaves intact (ø, æ, ß, …) that unaccent still folds.
export function foldCity(s: string): string {
  return (s || "")
    .replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/œ/gi, "oe")
    .replace(/ß/g, "ss").replace(/[đð]/gi, "d").replace(/ł/gi, "l").replace(/þ/gi, "th")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().trim();
}

// EXONYM aliases: an English/guide city name → the RPC needle that matches the form(s) stored in the
// DB `city` column, for cases accent-folding alone can't bridge (Lucerne≠Luzern, Bruges/Brugge).
// Accent-only variants (Málaga, Montréal) are handled by unaccent/foldCity and need NO entry.
// Derived from the shared exonym list (src/lib/exonyms.ts) using THIS module's foldCity, so the key
// matches exactly what aliasCity() folds an incoming name to. Every entry's spelling (english +
// locals) maps to the union needle, so any entry point (bruges- or brugge-slug) resolves the same.
// Each needle is DB-verified to only ADD matches (strict superset) — see exonyms.ts for the audit.
const CITY_DB_ALIAS: Record<string, string> = {};
for (const e of EXONYMS) {
  if (!e.match) continue;
  for (const spelling of [e.english, ...e.local]) CITY_DB_ALIAS[foldCity(spelling)] = e.match;
}
export function aliasCity(name: string): string {
  return CITY_DB_ALIAS[foldCity(name)] || name;
}

/** The slug a city string maps to (matches how the facet/city URL is built). */
export function cityBaseSlug(city: string): string {
  return cityToSlug(city).replace(/-cosy-hotel$/, "");
}

/**
 * Cosy hotels (score ≥ 5) belonging to a city, from a set of rows. Membership is a case-insensitive
 * substring match of the resolved city name — the exact predicate the facet page's `ilike '%city%'`
 * fetch uses — followed by dedup-by-name and the isLatin() name filter. Pass DB-fetched rows (page)
 * or an in-memory scan (sitemap); the result is identical for the same city.
 */
export function cityMembers(cityName: string, rows: ScoreHotelRow[]): CityCosyHotel[] {
  const needle = foldCity(aliasCity(cityName)); // accent- + exonym-tolerant, matches the SQL side
  const seen = new Set<string>();
  const hotels: CityCosyHotel[] = [];
  for (const r of rows) {
    const h = r.hotel;
    if (!h || !r.hotel_id) continue;
    if (!foldCity(h.city || "").includes(needle)) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    seen.add(name);
    hotels.push({
      id: String(r.hotel_id), slug: h.slug, name,
      city: displayCity(h.city, cityName), country: displayCountry(h.country),
      score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "",
      signals: r.signals, description: r.description, lat: h.lat ?? null, lng: h.lng ?? null,
    });
  }
  return hotels;
}

/**
 * All surfaced cosy hotels in a city slug (page path). One DB query (ilike prefilter) → cityMembers.
 * Returns null only when the DB is unavailable; an empty array means "no matching hotels".
 */
export async function loadCityCosyHotels(citySlug: string): Promise<{ cityName: string; hotels: CityCosyHotel[] } | null> {
  const db = getServerSupabase();
  if (!db) return null;
  const cityName = resolveCity(citySlug);
  // Accent-insensitive city match via the cosy_city_hotels RPC (Postgres unaccent) + exonym alias,
  // so hotels stored with diacritics ("Málaga", "Montréal", "Brașov") or a local name ("Luzern" for
  // Lucerne) are found. Plain ilike is accent-SENSITIVE, so those cities' pages used to 404.
  const { data, error } = await db.rpc("cosy_city_hotels", { q: aliasCity(cityName) });
  if (error) return null;
  const rows: ScoreHotelRow[] = ((data || []) as Array<Record<string, unknown>>).map((r) => ({
    hotel_id: r.hotel_id as string, score: r.score as number | null, score_final: r.score_final as number | null,
    signals: r.signals as string[] | null, description: r.description as string | null,
    hotel: { slug: r.slug as string, name: r.name as string, name_en: r.name_en as string | null, city: r.city as string | null, country: r.country as string | null, lat: r.lat as number | null, lng: r.lng as number | null },
  }));
  return { cityName, hotels: cityMembers(cityName, rows) };
}

/** Hotels in a city that match a facet (same predicate the facet page renders with). */
export function facetHotels(facet: Facet, hotels: CityCosyHotel[]): CityCosyHotel[] {
  return hotels.filter((h) => matchesFacet(facet, h.signals, h.description));
}

// ─────────────────────────────────────────────────────────────────────────────
// Traveller Fit — shared concept-membership contract (page ∪ hub ∪ sitemap agree)
//
// A live cosy hotel belongs to concept C iff EITHER
//   • stored: a hotel_traveller_fit row (C, hotel) with confidence ≥ C.minConfidence, OR
//   • legacy: C is one of the original 5 facets (LEGACY_FACET_SLUGS) and C's regex matches the
//     hotel's signals+description (identical to matchesFacet — the concept `re` equals the facet `re`).
// Union + dedup. This is a strict SUPERSET of today's facet membership, so the legacy 5 can only
// GAIN hotels; with hotel_traveller_fit empty every surface degrades to exactly today's behavior.
// ─────────────────────────────────────────────────────────────────────────────

/** Noindex threshold shared by the theme hub page and the hub index (a thinner hub is noindexed). */
export const THEME_HUB_INDEX_MIN = 8;

/** hotel_id → (concept_id → stored confidence). PK is (hotel_id, concept_id) so one value per pair. */
export type AssignmentsByHotel = Map<string, Map<string, number>>;

/**
 * Fetch stored hotel_traveller_fit assignments for the given concept slugs. When `hotelIds` is
 * given the query is restricted to those hotels (batched in .in() chunks — used by the city page);
 * otherwise it pages through every row for the concepts (used by the hub + sitemap). The table is
 * indexed on (concept_id, confidence desc). Returns an empty map when the DB is unavailable or the
 * table is empty — so every caller degrades to legacy-only membership.
 */
export async function loadConceptAssignments(conceptSlugs: string[], hotelIds?: string[]): Promise<AssignmentsByHotel> {
  const out: AssignmentsByHotel = new Map();
  const db = getServerSupabase();
  if (!db || conceptSlugs.length === 0) return out;
  const add = (rows: Array<Record<string, unknown>>) => {
    for (const r of rows) {
      const hid = r.hotel_id == null ? "" : String(r.hotel_id);
      const cid = r.concept_id == null ? "" : String(r.concept_id);
      const conf = Number(r.confidence);
      if (!hid || !cid || !Number.isFinite(conf)) continue;
      let m = out.get(hid);
      if (!m) { m = new Map(); out.set(hid, m); }
      const prev = m.get(cid);
      if (prev == null || conf > prev) m.set(cid, conf);
    }
  };
  if (hotelIds) {
    if (hotelIds.length === 0) return out;
    for (let i = 0; i < hotelIds.length; i += 200) {
      const { data, error } = await db
        .from("hotel_traveller_fit")
        .select("hotel_id, concept_id, confidence")
        .in("concept_id", conceptSlugs)
        .in("hotel_id", hotelIds.slice(i, i + 200));
      if (error) break;
      add((data || []) as Array<Record<string, unknown>>);
    }
    return out;
  }
  const pageSize = 1000;
  for (let from = 0; from < 500000; from += pageSize) {
    const { data, error } = await db
      .from("hotel_traveller_fit")
      .select("hotel_id, concept_id, confidence")
      .in("concept_id", conceptSlugs)
      // Order by the PK, not confidence: confidence is heavily tied (rule backfills sit exactly at
      // minConfidence), and offset-paging over a non-unique order can skip boundary rows.
      .order("hotel_id", { ascending: true })
      .order("concept_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    add(data as Array<Record<string, unknown>>);
    if (data.length < pageSize) break;
  }
  return out;
}

/**
 * Mirror of the cosy_city_hotels RPC's row universe: raw score ≥ 5, accent-folded substring city
 * match, top 80 by raw score. Any in-memory membership COUNT must run over this universe — the city
 * page renders from the RPC, so counting over an unbounded scan can emit a link/sitemap URL whose
 * page then 404s (bathtub/venice: 5 members city-wide, only 4 inside the page's top-80).
 */
export function rpcCityUniverse(cityName: string, rows: ScoreHotelRow[]): ScoreHotelRow[] {
  const needle = foldCity(aliasCity(cityName));
  return rows
    .filter((r) => Number(r.score ?? 0) >= 5 && foldCity(r.hotel?.city || "").includes(needle))
    .sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
    .slice(0, 80);
}

/**
 * A concept's city members exactly as the CITY PAGE computes them (RPC fetch → cityMembers →
 * stored assignments → conceptMembers). Every surface that decides whether to LINK a city
 * collection (hotel-page badges, theme-hub city links) must use this so it can never disagree
 * with the page it links to. Null only when the DB is unavailable.
 */
export async function conceptCityMembersLive(
  concept: TravellerFitConcept,
  citySlug: string,
): Promise<ConceptCosyHotel[] | null> {
  const res = await loadCityCosyHotels(citySlug);
  if (!res) return null;
  const assignments = await loadConceptAssignments([concept.slug], res.hotels.map((h) => h.id));
  return conceptMembers(concept, res.hotels, assignments);
}

/** A concept member carries the stored confidence (null when matched only by the legacy regex). */
export type ConceptCosyHotel = CityCosyHotel & { fitConfidence: number | null };

/**
 * Members of a concept among an already-resolved set of city cosy hotels, per the membership
 * contract above. `assignments` is the stored map (empty ⇒ legacy-only). Preserves the input order
 * (callers re-order); use orderConceptMembers to sort stored-confidence-first.
 */
export function conceptMembers(
  concept: TravellerFitConcept,
  hotels: CityCosyHotel[],
  assignments: AssignmentsByHotel,
): ConceptCosyHotel[] {
  const isLegacy = LEGACY_FACET_SLUGS.has(concept.slug);
  const out: ConceptCosyHotel[] = [];
  for (const h of hotels) {
    const stored = assignments.get(h.id)?.get(concept.slug);
    const storedOk = stored != null && stored >= concept.minConfidence;
    // Legacy regex = matchesFacet semantics (concept.re === the facet re for the original 5).
    const legacyOk = isLegacy && concept.re.test(`${(h.signals || []).join(" ")} ${h.description || ""}`);
    if (storedOk || legacyOk) out.push({ ...h, fitConfidence: storedOk ? stored : null });
  }
  return out;
}

/**
 * Order members stored-confidence desc then cosy-score desc. When NO member has a stored confidence
 * (the empty-table / legacy-only case) the input order is returned untouched, so legacy pages render
 * byte-identically to today (which relied on the RPC/scan order).
 */
export function orderConceptMembers(members: ConceptCosyHotel[]): ConceptCosyHotel[] {
  if (!members.some((m) => m.fitConfidence != null)) return members;
  return [...members].sort((a, b) => {
    const ca = a.fitConfidence ?? -1, cb = b.fitConfidence ?? -1;
    if (cb !== ca) return cb - ca;
    return b.score - a.score;
  });
}

/**
 * The noun phrase used in "Cosy hotels {phrase} in {City}". For the legacy 5 it returns the exact
 * facets.ts label (so those indexed titles/H1s stay byte-identical); for new concepts it uses the
 * concept's own noun.
 */
export function conceptLabelPhrase(c: TravellerFitConcept): string {
  return facetBySlug(c.slug)?.label ?? c.noun;
}

/** Collection-enabled concepts, legacy 5 first (their order matches the old FACETS array). */
export function collectionConcepts(): TravellerFitConcept[] {
  return CONCEPTS.filter((c) => c.collectionEnabled);
}

/**
 * Theme hubs to list on the /cosy-hotels index: the legacy 5 always (as today), plus any new
 * collection-enabled concept whose LIVE stored membership clears the noindex threshold — so the
 * index never links a hub that would render thin/noindexed. Empty table ⇒ just the legacy 5.
 */
export async function listedThemeConcepts(): Promise<TravellerFitConcept[]> {
  const legacy = CONCEPTS.filter((c) => c.collectionEnabled && LEGACY_FACET_SLUGS.has(c.slug));
  const fresh = CONCEPTS.filter((c) => c.collectionEnabled && !LEGACY_FACET_SLUGS.has(c.slug));
  if (fresh.length === 0) return legacy;
  const assignments = await loadConceptAssignments(fresh.map((c) => c.slug));
  const counts = new Map<string, number>();
  for (const [, m] of assignments) {
    for (const [cid, conf] of m) {
      const c = CONCEPT_BY_SLUG[cid];
      if (c && conf >= c.minConfidence) counts.set(cid, (counts.get(cid) || 0) + 1);
    }
  }
  const shown = fresh.filter((c) => (counts.get(c.slug) || 0) >= THEME_HUB_INDEX_MIN);
  return [...legacy, ...shown];
}

/**
 * Live cosy-hotel count for a city NAME (city-guide gate). Fails OPEN (high number) on DB error,
 * matching the city-guide page which stays indexable when the count query fails.
 */
export async function liveCosyCountForCityName(cityName: string): Promise<number> {
  const db = getServerSupabase();
  if (!db) return 99;
  try {
    // Accent-insensitive + exonym-aliased count (matches loadCityCosyHotels), so the city-guide
    // thin gate and the sitemap agree, and diacritic/local-name cities aren't wrongly marked thin.
    const { data, error } = await db.rpc("cosy_city_count", { q: aliasCity(cityName) });
    if (error) return 99; // fail-open (stay indexable), matching the page
    return typeof data === "number" ? data : 0;
  } catch {
    return 99;
  }
}

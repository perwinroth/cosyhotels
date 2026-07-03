// SINGLE source of truth for "which cosy hotels are in a city", shared by the /cosy-hotels/[facet]/
// [city] page and the sitemap. Previously the page applied dedup-by-name + isLatin() + an ilike city
// match that the sitemap's raw count skipped, so the sitemap listed (facet, city) URLs the page then
// 404'd (21 such URLs in GSC "Crawled – not indexed"). Now BOTH derive membership from the same pure
// predicate (cityMembers) — the page fetches its rows via ilike, the sitemap filters an in-memory
// scan — so their counts can never disagree, and neither needs a per-city round-trip.
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { matchesFacet, type Facet } from "@/lib/facets";

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
  const needle = cityName.toLowerCase();
  const seen = new Set<string>();
  const hotels: CityCosyHotel[] = [];
  for (const r of rows) {
    const h = r.hotel;
    if (!h || !r.hotel_id) continue;
    if (!(h.city || "").toLowerCase().includes(needle)) continue;
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
  // Match the stored city with its NATURAL spacing — city values are space-separated ("New York",
  // "San Francisco", "Hoi An"). The old code hyphenated the pattern ("New-York") which matched
  // nothing, so every multi-word-city facet page 404'd (and the sitemap listed 404 URLs).
  const { data } = await db
    .from("cosy_scores")
    .select(CITY_HOTEL_SELECT)
    .gte("score", 5)
    .ilike("hotel.city", `%${cityName}%`)
    .order("score", { ascending: false })
    .limit(80);
  return { cityName, hotels: cityMembers(cityName, (data || []) as unknown as ScoreHotelRow[]) };
}

/** Hotels in a city that match a facet (same predicate the facet page renders with). */
export function facetHotels(facet: Facet, hotels: CityCosyHotel[]): CityCosyHotel[] {
  return hotels.filter((h) => matchesFacet(facet, h.signals, h.description));
}

/**
 * Live cosy-hotel count for a city NAME (city-guide gate). Fails OPEN (high number) on DB error,
 * matching the city-guide page which stays indexable when the count query fails.
 */
export async function liveCosyCountForCityName(cityName: string): Promise<number> {
  const db = getServerSupabase();
  if (!db) return 99;
  try {
    const { count } = await db
      .from("cosy_scores")
      .select("hotel_id, hotel:hotel_id!inner(city)", { count: "exact", head: true })
      .gte("score", 5)
      .ilike("hotel.city", `%${cityName}%`);
    return count ?? 0;
  } catch {
    return 99;
  }
}

import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { getDelistedSlugSet } from "@/lib/delisted";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";
import { cities } from "@/data/cities";
import { citiesLarge } from "@/data/cities_large";
import { cityGuides } from "@/data/cityGuides";
import { guideCityHasLivePick } from "@/lib/seo/guidePicks";
import { COUNTRIES } from "@/lib/country";
import { loadCountryCounts, loadCountryHotels, HUB_404_BELOW } from "@/lib/countryHub";
import { REGIONS } from "@/data/regions";
import { PUBLIC_GATE } from "@/lib/scoring/cosy";

// ONE implementation of the site search, shared by the /api/search autocomplete route and the
// /[locale]/search results page. Hotels are matched across the FULL live catalogue by name;
// cities/countries are only returned when they resolve to a live page (so links never 404).

export type HotelHit = {
  slug: string;
  name: string;
  city: string;
  country: string;
  score: number;
  description?: string;
  website?: string | null;
};
export type CityHit = { name: string; slug: string };
export type CountryHit = { name: string; slug: string; count: number };
export type RegionHit = { name: string; slug: string; the: boolean };
export type SearchResults = { hotels: HotelHit[]; cities: CityHit[]; countries: CountryHit[]; regions: RegionHit[] };

// Curated guide cities first (guaranteed to render), then the broad autocomplete list.
const ALL_CITIES: string[] = Array.from(
  new Set([...cityGuides.map((g) => g.city), ...cities, ...citiesLarge]),
);

// Match live hotels (score >= 5) by name / English name / CITY, ordered by relevance. Matching city
// too means a city-name query ("new york") surfaces the hotels IN that city — not just hotels whose
// NAME happens to contain it (which returned e.g. a Budapest hotel named "New York Palace"). `limit`
// caps the returned rows (autocomplete wants ~6, the results page wants ~24).
export async function searchHotels(q: string, limit = 6): Promise<HotelHit[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const escaped = q.replace(/[%_,]/g, (m) => `\\${m}`);
  const lower = q.toLowerCase();
  // Step 1: match on hotel name, English name, OR city. A city can hold many hotels, so pull a
  // generous slice for the score filter/sort below to fill `limit`.
  const { data: rows, error } = await db
    .from("hotels")
    .select("id,slug,name,name_en,city,country,website")
    .or(`name.ilike.%${escaped}%,name_en.ilike.%${escaped}%,city.ilike.%${escaped}%`)
    // Big cap: a city can hold hundreds of hotels, most NOT live — fetch enough that the live ones
    // (filtered below) always fall inside the candidate window, so autocomplete ranks by true score.
    .limit(500);
  if (error || !rows?.length) return [];
  const delisted = await getDelistedSlugSet(db);

  // Step 2: keep only hotels with a live score (>= the shared PUBLIC_GATE); attach displayed score
  // + description.
  const ids = rows.map((r) => r.id);
  const { data: scores } = await db
    .from("cosy_scores")
    .select("hotel_id,score,score_final,description")
    .in("hotel_id", ids)
    .gte("score", PUBLIC_GATE);
  const byId = new Map<string, { score: number; description: string | null }>();
  for (const s of scores || []) {
    const sf = (s.score_final as number | null) ?? (s.score as number | null);
    if (typeof sf === "number") byId.set(s.hotel_id as string, { score: sf, description: (s.description as string | null) ?? null });
  }

  return rows
    .filter((r) => byId.has(r.id) && r.slug && !delisted.has(r.slug as string))
    .map((r) => {
      const hit = byId.get(r.id)!;
      const name = (r.name_en as string | null) || (r.name as string);
      return {
        slug: r.slug as string,
        name,
        rawCity: (r.city as string | null) || "",
        rawCountry: (r.country as string | null) || "",
        score: hit.score,
        description: hit.description ?? undefined,
        website: (r.website as string | null) ?? null,
      };
    })
    // Site convention: only show Latin-script names on the English site.
    .filter((h) => isLatin(h.name))
    // Hotels whose CITY matches the query rank above pure name-substring matches, then by score —
    // so "new york" leads with real NYC hotels, not a Budapest hotel named "New York Palace".
    // Matching uses the raw stored city (pre-normalization) so it stays byte-consistent with the
    // `.ilike` DB query above.
    .sort((a, b) => {
      const ac = a.rawCity.toLowerCase().includes(lower) ? 1 : 0;
      const bc = b.rawCity.toLowerCase().includes(lower) ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return b.score - a.score;
    })
    .slice(0, limit)
    // Display fields only: normalize city/country the same way every other listing surface does
    // (countryHub.ts, seo/cityHotels.ts) so adjacent cards never show raw variants like "Sverige"
    // next to "Sweden".
    .map(({ rawCity, rawCountry, ...h }) => ({
      ...h,
      city: displayCity(rawCity),
      country: displayCountry(rawCountry),
    }));
}

// Match cities against the site's city set and VERIFY each has a live guide via guideCityHasLivePick,
// the SAME pick-determination the guide page renders with, so returned city links always resolve.
// A plain substring-based live count (the former `cosy_city_count` RPC check) can be true while
// the guide's stricter exact-match TRUST filter still finds zero picks (2026-07-16 link audit:
// OSM postcode-suffixed or differently-punctuated raw `hotels.city` values), so it is not a safe
// existence check on its own; see guidePicks.ts's module comment.
export async function searchCities(q: string, limit = 5): Promise<CityHit[]> {
  const lower = q.toLowerCase();
  const starts = ALL_CITIES.filter((c) => c.toLowerCase().startsWith(lower));
  const contains = ALL_CITIES.filter(
    (c) => !c.toLowerCase().startsWith(lower) && c.toLowerCase().includes(lower),
  );
  const candidates = [...starts, ...contains].slice(0, 8);
  const db = getServerSupabase();
  const verified = await Promise.all(
    candidates.map(async (name) => ((await guideCityHasLivePick(db, name)) ? name : null)),
  );
  return verified
    .filter((c): c is string => c !== null)
    .slice(0, limit)
    .map((name) => ({ name, slug: cityToSlug(name).replace(/-cosy-hotel$/, "") }));
}

// Country live-counts change only when the scoring pipeline runs, but loadCountryCounts scans every
// live score — too heavy for a per-keystroke autocomplete. Cache the result across requests.
const cachedCountryCounts = unstable_cache(loadCountryCounts, ["search-country-counts"], { revalidate: 3600 });

// Match countries against the curated canonical list (name + ASCII words like "uk"/"usa"), then keep
// only those whose hub actually renders (>= HUB_404_BELOW live hotels) so a result never links to a 404.
export async function searchCountries(q: string, limit = 4): Promise<CountryHit[]> {
  const lower = q.toLowerCase();
  const matched = COUNTRIES.filter((c) => {
    const name = c.name.toLowerCase();
    if (name.startsWith(lower) || c.words.some((w) => w.startsWith(lower))) return true;
    if (lower.length >= 4 && (name.includes(lower) || c.words.some((w) => w.includes(lower)))) return true;
    return false;
  });
  if (!matched.length) return [];
  const counts = await cachedCountryCounts();
  const liveBySlug = new Map(counts.map((r) => [r.country.slug, r.live]));
  return matched
    .map((c) => ({ name: c.name, slug: c.slug, count: liveBySlug.get(c.slug) ?? 0 }))
    .filter((c) => c.count >= HUB_404_BELOW)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Match curated regions ("Amalfi Coast", "Tuscany") by name. Synchronous + cheap — regions are a
// small curated list and every seeded one resolves to a live hub, so no DB gate is needed.
export function searchRegions(q: string, limit = 3): RegionHit[] {
  const lower = q.toLowerCase();
  return REGIONS.filter((r) => {
    const n = r.name.toLowerCase();
    return n.startsWith(lower) || (lower.length >= 3 && n.includes(lower));
  })
    .slice(0, limit)
    .map((r) => ({ name: r.name, slug: r.slug, the: r.the }));
}

// Queries arrive as natural phrases ("cosy hotels in sweden"). Strip our own vocabulary and
// connective filler so the place or name underneath can match; used as a retry when the raw
// phrase finds nothing, never as the first attempt (hotel NAMES legitimately contain "hotel").
const FILLER = new Set([
  "cosy", "cozy", "cosiest", "coziest", "hotel", "hotels", "stay", "stays",
  "in", "the", "a", "an", "for", "of", "best", "most", "near", "with", "and", "to",
]);
export function coreQuery(q: string): string {
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .join(" ")
    .trim();
}

type SearchOpts = { hotelLimit?: number; cityLimit?: number; countryLimit?: number; regionLimit?: number };

async function runSearch(query: string, opts?: SearchOpts): Promise<SearchResults> {
  const [hotels, cities, countries] = await Promise.all([
    searchHotels(query, opts?.hotelLimit ?? 6),
    searchCities(query, opts?.cityLimit ?? 5),
    searchCountries(query, opts?.countryLimit ?? 4),
  ]);
  const regions = searchRegions(query, opts?.regionLimit ?? 3);
  return { hotels, cities, countries, regions };
}

const hasAny = (r: SearchResults) =>
  r.hotels.length > 0 || r.cities.length > 0 || r.countries.length > 0 || r.regions.length > 0;

// Combined lookup used by both the API route and the results page.
export async function searchSite(
  q: string,
  opts?: SearchOpts,
): Promise<SearchResults> {
  const query = q.trim();
  if (query.length < 2) return { hotels: [], cities: [], countries: [], regions: [] };

  let results = await runSearch(query, opts);

  // Natural-phrase retry: "cosy hotels in sweden" found nothing raw, so search its core ("sweden").
  if (!hasAny(results)) {
    const core = coreQuery(query);
    if (core.length >= 2 && core !== query.toLowerCase()) results = await runSearch(core, opts);
  }

  // Country intent answers with hotels, not only a link: a matched country with no hotel rows
  // pulls its top-scored live hotels inline (same loader as the country hub page, so the list
  // matches what the hub shows and never features below-gate hotels).
  if (results.hotels.length === 0 && results.countries.length > 0) {
    const canon = COUNTRIES.find((c) => c.slug === results.countries[0].slug);
    if (canon) {
      const hub = await loadCountryHotels(canon, opts?.hotelLimit ?? 6);
      results = {
        ...results,
        hotels: hub.map((h) => ({
          slug: h.slug, name: h.name, city: h.city, country: h.country,
          score: h.score, description: h.snippet || undefined,
        })).filter((h) => isLatin(h.name)),
      };
    }
  }

  return results;
}

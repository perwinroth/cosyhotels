import { unstable_cache } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";
import { cities } from "@/data/cities";
import { citiesLarge } from "@/data/cities_large";
import { cityGuides } from "@/data/cityGuides";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { COUNTRIES } from "@/lib/country";
import { loadCountryCounts, HUB_404_BELOW } from "@/lib/countryHub";

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
};
export type CityHit = { name: string; slug: string };
export type CountryHit = { name: string; slug: string; count: number };
export type SearchResults = { hotels: HotelHit[]; cities: CityHit[]; countries: CountryHit[] };

// Curated guide cities first (guaranteed to render), then the broad autocomplete list.
const ALL_CITIES: string[] = Array.from(
  new Set([...cityGuides.map((g) => g.city), ...cities, ...citiesLarge]),
);

// Match all live hotels (score >= 5) by name / English name, ordered by displayed score. `limit`
// caps the returned rows (autocomplete wants ~6, the results page wants ~24).
export async function searchHotels(q: string, limit = 6): Promise<HotelHit[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const escaped = q.replace(/[%_,]/g, (m) => `\\${m}`);
  // Step 1: name match on hotels (name + English name). Pull a generous slice so the score
  // filter/sort below still has enough candidates to fill `limit`.
  const { data: rows, error } = await db
    .from("hotels")
    .select("id,slug,name,name_en,city,country")
    .or(`name.ilike.%${escaped}%,name_en.ilike.%${escaped}%`)
    .limit(Math.max(40, limit * 4));
  if (error || !rows?.length) return [];

  // Step 2: keep only hotels with a live score (>=5); attach displayed score + description.
  const ids = rows.map((r) => r.id);
  const { data: scores } = await db
    .from("cosy_scores")
    .select("hotel_id,score,score_final,description")
    .in("hotel_id", ids)
    .gte("score", 5);
  const byId = new Map<string, { score: number; description: string | null }>();
  for (const s of scores || []) {
    const sf = (s.score_final as number | null) ?? (s.score as number | null);
    if (typeof sf === "number") byId.set(s.hotel_id as string, { score: sf, description: (s.description as string | null) ?? null });
  }

  return rows
    .filter((r) => byId.has(r.id) && r.slug)
    .map((r) => {
      const hit = byId.get(r.id)!;
      const name = (r.name_en as string | null) || (r.name as string);
      return {
        slug: r.slug as string,
        name,
        city: (r.city as string | null) || "",
        country: (r.country as string | null) || "",
        score: hit.score,
        description: hit.description ?? undefined,
      };
    })
    // Site convention: only show Latin-script names on the English site.
    .filter((h) => isLatin(h.name))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// Match cities against the site's city set and VERIFY each has a live guide (>=1 live hotel) via
// the existing unaccent cosy_city_count RPC, so returned city links always resolve (guides 404 at 0).
export async function searchCities(q: string, limit = 5): Promise<CityHit[]> {
  const lower = q.toLowerCase();
  const starts = ALL_CITIES.filter((c) => c.toLowerCase().startsWith(lower));
  const contains = ALL_CITIES.filter(
    (c) => !c.toLowerCase().startsWith(lower) && c.toLowerCase().includes(lower),
  );
  const candidates = [...starts, ...contains].slice(0, 8);
  const verified = await Promise.all(
    candidates.map(async (name) => ((await liveCosyCountForCityName(name)) > 0 ? name : null)),
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

// Combined lookup used by both the API route and the results page.
export async function searchSite(
  q: string,
  opts?: { hotelLimit?: number; cityLimit?: number; countryLimit?: number },
): Promise<SearchResults> {
  const query = q.trim();
  if (query.length < 2) return { hotels: [], cities: [], countries: [] };
  const [hotels, cities, countries] = await Promise.all([
    searchHotels(query, opts?.hotelLimit ?? 6),
    searchCities(query, opts?.cityLimit ?? 5),
    searchCountries(query, opts?.countryLimit ?? 4),
  ]);
  return { hotels, cities, countries };
}

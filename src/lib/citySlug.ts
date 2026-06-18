// City <-> guide-slug mapping with correct diacritic handling.
// Bug this fixes: "Malmö" was slugified to "malm" (the ö was stripped, not transliterated),
// which then fuzzy-matched "Malmesbury, UK". We now transliterate (ö→o) and reverse-map the
// slug back to the real city name (recovering the diacritics) from the known-city list.
import { cities } from "@/data/cities";
import { citiesLarge } from "@/data/cities_large";

function slugBase(city: string): string {
  return city
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // ö -> o, é -> e, etc. (transliterate, don't drop)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cityToSlug(city: string): string {
  return `${slugBase(city)}-cosy-hotel`;
}

const KNOWN: string[] = Array.from(new Set([...cities, ...citiesLarge]));
const bySlugBase = new Map<string, string>();
for (const c of KNOWN) {
  const b = slugBase(c);
  if (b && !bySlugBase.has(b)) bySlugBase.set(b, c);
}

// "malmo-cosy-hotel" -> "Malmö" (recovers the proper city name + diacritics). null if unknown.
export function cityFromSlug(slug: string): string | null {
  const b = slug.replace(/-cosy-hotel$/, "");
  return bySlugBase.get(b) || null;
}

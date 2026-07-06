import { getServerSupabase } from "@/lib/supabase/server";

// Fire-and-forget on-site search logging. Records what users actually type into the site search —
// especially queries that return NOTHING, which is the demand signal GSC can't show us (people
// searching for regions/countries/hotels we don't yet cover). MUST never block or throw into the
// request path: any failure is swallowed. Writes to the RLS-locked `search_queries` table.
export function logSearch(
  q: string,
  counts: { hotels: number; cities: number; countries: number; locale?: string },
): void {
  try {
    const db = getServerSupabase();
    if (!db) return;
    const hits = counts.hotels + counts.cities + counts.countries;
    void db
      .from("search_queries")
      .insert({
        q: q.slice(0, 200),
        hotels: counts.hotels,
        cities: counts.cities,
        countries: counts.countries,
        hits,
        locale: counts.locale ?? null,
      })
      .then(
        () => {},
        () => {}, // best-effort: never surface logging errors
      );
  } catch {
    /* never let logging break search */
  }
}

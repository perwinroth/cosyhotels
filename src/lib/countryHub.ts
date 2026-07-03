// DB helpers for country hubs (WP3). Kept out of country.ts so that stays a pure, testable lib.
import { cache } from "react";
import { getServerSupabase } from "@/lib/supabase/server";
import { canonicalCountry, type CanonCountry } from "@/lib/country";
import { displayCity, isLatin } from "@/lib/placeText";

// A country hub must clear this many live hotels (score ≥ 5) to be listed + indexed. Thinner
// countries still resolve (the page renders) but are noindexed, mirroring the WP4 thin-page gate.
export const HUB_MIN = 8;
// Below this the page has too little to justify existing at all → 404 (matches facet pages).
export const HUB_404_BELOW = 3;

// cosy_scores has exactly one row per hotel (verified), so a per-row tally is an exact live count.
// cache()'d so generateMetadata + the page body in one render share a single scan.
export const loadCountryCounts = cache(async (): Promise<Array<{ country: CanonCountry; live: number }>> => {
  const db = getServerSupabase();
  if (!db) return [];
  const tally = new Map<string, { country: CanonCountry; live: number }>();
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await db
      .from("cosy_scores")
      .select("hotel:hotel_id!inner(country)")
      .gte("score", 5)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as unknown as Array<{ hotel: { country: string | null } | null }>) {
      const c = canonicalCountry(r.hotel?.country);
      if (!c) continue;
      const cur = tally.get(c.slug);
      if (cur) cur.live++; else tally.set(c.slug, { country: c, live: 1 });
    }
    if (data.length < pageSize) break;
  }
  return [...tally.values()].sort((a, b) => b.live - a.live);
});

export type HubHotel = { id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null };
type CRow = { hotel_id: string; score: number | null; score_final: number | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat?: number | null; lng?: number | null } | null };
const rowScore = (r: CRow) => Number((r.score_final ?? r.score) || 0);

// Top cosy hotels for a country. Candidates are fetched via ilike patterns (exact match for short
// tokens like "uk"/"usa" so we don't drag in "Fukuoka"), then re-filtered through the canonicaliser
// so an over-broad pattern can never leak a wrong-country hotel into the list.
export async function loadCountryHotels(country: CanonCountry, limit = 60): Promise<HubHotel[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const patterns = [
    ...country.words.map((w) => (w.length <= 4 && !w.includes(" ") ? w : `%${w}%`)), // ≤4 chars → exact (no %)
    ...(country.aliases || []),                                                       // native/composite → exact
  ];
  const byId = new Map<string, CRow>();
  for (const pat of patterns) {
    const { data } = await db
      .from("cosy_scores")
      .select("hotel_id, score, score_final, description, hotel:hotel_id!inner(slug, name, name_en, city, country, lat, lng)")
      .gte("score", 5)
      .ilike("hotel.country", pat)
      .order("score", { ascending: false })
      .limit(200);
    for (const r of (data || []) as unknown as CRow[]) if (r.hotel_id && r.hotel) byId.set(String(r.hotel_id), r);
  }
  const seenName = new Set<string>();
  const out: HubHotel[] = [];
  for (const r of [...byId.values()].sort((a, b) => rowScore(b) - rowScore(a))) {
    const h = r.hotel!;
    if (canonicalCountry(h.country)?.slug !== country.slug) continue; // correctness guard
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seenName.has(name)) continue;
    seenName.add(name);
    out.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: country.name, score: rowScore(r), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

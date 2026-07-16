// DB helpers for REGION hubs — the geo-bbox analogue of countryHub.ts. A region resolves to the live
// cosy hotels (score ≥ 5) whose lat/lng fall inside its bounding box: a plain bounded query, no RPC and
// no migration. Reuses HubHotel + the hub thresholds so region pages behave exactly like country hubs.
import { getServerSupabase } from "@/lib/supabase/server";
import { getDelistedSlugSet } from "@/lib/delisted";
import { displayCity, isLatin } from "@/lib/placeText";
import { type HubHotel, HUB_MIN, HUB_404_BELOW } from "@/lib/countryHub";
import type { Region } from "@/data/regions";

export { HUB_MIN, HUB_404_BELOW };

type CRow = { hotel_id: string; score: number | null; score_final: number | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat?: number | null; lng?: number | null } | null };
const rowScore = (r: CRow) => Number((r.score_final ?? r.score) || 0);

// Top cosy hotels inside a region's bbox, ranked by displayed score, deduped by name, Latin-script only.
export async function loadRegionHotels(region: Region, limit = 60): Promise<HubHotel[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const [minLng, minLat, maxLng, maxLat] = region.bbox;
  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, description, hotel:hotel_id!inner(slug, name, name_en, city, country, lat, lng)")
    .gte("score", 5)
    .gte("hotel.lat", minLat).lte("hotel.lat", maxLat)
    .gte("hotel.lng", minLng).lte("hotel.lng", maxLng)
    .order("score", { ascending: false })
    .limit(300);
  const delisted = await getDelistedSlugSet(db);
  const seenName = new Set<string>();
  const out: HubHotel[] = [];
  for (const r of ((data || []) as unknown as CRow[]).sort((a, b) => rowScore(b) - rowScore(a))) {
    const h = r.hotel;
    if (!h) continue;
    if (delisted.has(h.slug)) continue; // takedown excludes listing surfaces
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seenName.has(name)) continue;
    seenName.add(name);
    out.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: region.country, score: rowScore(r), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null });
    if (out.length >= limit) break;
  }
  return out;
}

// Cheap live-hotel count inside the bbox (raw, pre-dedup) — for the thin/noindex gate + intro copy.
export async function loadRegionCount(region: Region): Promise<number> {
  const db = getServerSupabase();
  if (!db) return 0;
  const [minLng, minLat, maxLng, maxLat] = region.bbox;
  const { count } = await db
    .from("cosy_scores")
    .select("hotel_id, hotel:hotel_id!inner(lat,lng)", { count: "exact", head: true })
    .gte("score", 5)
    .gte("hotel.lat", minLat).lte("hotel.lat", maxLat)
    .gte("hotel.lng", minLng).lte("hotel.lng", maxLng);
  return count ?? 0;
}

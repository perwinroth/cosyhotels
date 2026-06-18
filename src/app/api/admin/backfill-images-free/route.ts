// Replace placehold.co placeholder images with real, free, cacheable photos.
// Uses the same free resolver as the live OSM path (website og:image → Wikidata P18 →
// name-matched Wikimedia Commons geosearch → honest placeholder). NO Google Places.
//
// Why a dedicated route: /api/admin/backfill-images skips any hotel that already has an
// image row, but ~98% of hotels have a *placeholder* row — so they'd never be touched.
// This route specifically targets placeholder rows and upgrades them in place.
//
// Params: ?limit=50 (max 500), ?dry=1 (resolve + report, write nothing),
//         ?after=<hotel_id> forward cursor so a full sweep attempts each hotel exactly once
//         (hotels with no findable photo keep their placeholder and aren't retried).
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveHotelImage } from "@/lib/hotelImageFree";

export const runtime = "nodejs";
export const maxDuration = 300;

type HotelRow = { id: string; name: string; website: string | null; city: string | null; lat: number | null; lng: number | null };

async function run(limit: number, dry: boolean, after: string) {
  const db = getServerSupabase();
  if (!db) return { error: "Supabase not configured" } as const;

  // 1) Hotels whose stored image is a placeholder, walked forward by hotel_id cursor
  //    (dedup to distinct hotel ids).
  let q = db
    .from("hotel_images")
    .select("hotel_id")
    .like("url", "%placehold.co%")
    .order("hotel_id", { ascending: true })
    .limit(limit * 4);
  if (after) q = q.gt("hotel_id", after);
  const { data: phRows, error: e1 } = await q;
  if (e1) return { error: e1.message } as const;
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const r of (phRows || []) as Array<{ hotel_id: string | null }>) {
    const id = r.hotel_id ? String(r.hotel_id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= limit) break;
  }
  if (!ids.length) return { processed: 0, replaced: 0, results: [], nextCursor: null, done: true } as const;
  const nextCursor = ids[ids.length - 1];

  // 2) Load hotel detail for the free resolver.
  const { data: hotels, error: e2 } = await db
    .from("hotels")
    .select("id,name,website,city,lat,lng")
    .in("id", ids);
  if (e2) return { error: e2.message } as const;

  const results: Array<{ name: string; source: string; newUrl: string | null }> = [];
  let replaced = 0;
  const CONC = 6;
  const rows = (hotels || []) as HotelRow[];
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (h) => {
        try {
          const r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city });
          if (r.source !== "placeholder") {
            if (!dry) {
              await db
                .from("hotel_images")
                .update({ url: r.url, attributions: r.attribution ?? null })
                .eq("hotel_id", h.id)
                .like("url", "%placehold.co%");
            }
            replaced++;
            results.push({ name: h.name, source: r.source, newUrl: r.url });
          } else {
            results.push({ name: h.name, source: "placeholder", newUrl: null });
          }
        } catch {
          results.push({ name: h.name, source: "error", newUrl: null });
        }
      })
    );
  }
  return { processed: rows.length, replaced, dry, nextCursor, done: false, results } as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "50")));
  const dry = url.searchParams.get("dry") === "1";
  const after = url.searchParams.get("after") || "";
  const res = await run(limit, dry, after);
  const status = "error" in res ? 500 : 200;
  return NextResponse.json(res, { status });
}

// Re-resolve a fresh, free photo for hotels whose only image was vision-QA-rejected as junk
// (vision_ok=false) — e.g. gift vouchers, logos, maps. Sibling to backfill-images-free (which
// only upgrades placehold.co rows). Uses the same free resolver (website og:image → Wikidata →
// name-matched Wikimedia geo), EXCLUDING the junk URL so it returns a genuinely different photo,
// then INSERTS a new vision_ok=null row (newest → city pages pick it over the junk). No API cost.
//
// Params: ?limit=50 (max 500) · ?dry=1 (resolve + report, write nothing) ·
//         ?after=<hotel_id> forward cursor for a full sweep.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveHotelImage } from "@/lib/hotelImageFree";

export const runtime = "nodejs";
export const maxDuration = 300;

type HotelRow = { id: string; name: string; website: string | null; city: string | null; lat: number | null; lng: number | null };

async function run(limit: number, dry: boolean, after: string) {
  const db = getServerSupabase();
  if (!db) return { error: "Supabase not configured" } as const;

  // 1) Hotels with a junk (vision_ok=false) image, walked forward by hotel_id cursor.
  let q = db
    .from("hotel_images")
    .select("hotel_id,url")
    .eq("vision_ok", false)
    .order("hotel_id", { ascending: true })
    .limit(limit * 8);
  if (after) q = q.gt("hotel_id", after);
  const { data: junkRows, error: e1 } = await q;
  if (e1) return { error: e1.message } as const;

  const junkByHotel = new Map<string, string[]>();
  const order: string[] = [];
  for (const r of (junkRows || []) as Array<{ hotel_id: string | null; url: string | null }>) {
    const id = r.hotel_id ? String(r.hotel_id) : "";
    if (!id) continue;
    if (!junkByHotel.has(id)) { junkByHotel.set(id, []); order.push(id); }
    if (r.url) junkByHotel.get(id)!.push(String(r.url));
  }
  const ids = order.slice(0, limit);
  if (!ids.length) return { processed: 0, added: 0, results: [], nextCursor: null, done: true } as const;
  const nextCursor = ids[ids.length - 1];

  // 2) Skip hotels that ALREADY have a non-junk image (vision_ok true or null) — they render fine.
  const { data: okRows } = await db.from("hotel_images").select("hotel_id").in("hotel_id", ids).or("vision_ok.is.null,vision_ok.is.true");
  const haveOk = new Set(((okRows || []) as Array<{ hotel_id: string | null }>).map((r) => String(r.hotel_id)));
  const need = ids.filter((id) => !haveOk.has(id));

  const { data: hotels, error: e2 } = await db.from("hotels").select("id,name,website,city,lat,lng").in("id", need);
  if (e2) return { error: e2.message } as const;

  const results: Array<{ name: string; source: string; newUrl: string | null }> = [];
  let added = 0;
  const CONC = 6;
  const rows = (hotels || []) as HotelRow[];
  for (let i = 0; i < rows.length; i += CONC) {
    const batch = rows.slice(i, i + CONC);
    await Promise.all(
      batch.map(async (h) => {
        try {
          const r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city, exclude: junkByHotel.get(h.id) || [] });
          if (r.source !== "placeholder") {
            if (!dry) await db.from("hotel_images").insert({ hotel_id: h.id, url: r.url, attributions: r.attribution ?? null, vision_ok: null });
            added++;
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
  return { processed: rows.length, added, skippedAlreadyOk: ids.length - need.length, dry, nextCursor, done: false, results } as const;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || "50")));
  const dry = url.searchParams.get("dry") === "1";
  const after = url.searchParams.get("after") || "";
  const res = await run(limit, dry, after);
  return NextResponse.json(res, { status: "error" in res ? 500 : 200 });
}

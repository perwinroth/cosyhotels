// Ingest lodging for one city from OpenStreetMap (free) into Supabase `hotels`, and resolve
// a real free photo for each (so vision scoring later has evidence). osmSearchHotels applies
// the junk/quality gate (isRealLodging). Hotels go in UNSCORED; run recompute-scores?city=
// afterwards to score them (vision), and the public 50/100 gate decides what surfaces.
//   GET /api/admin/ingest-city?city=Malmö
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { osmSearchHotels, type OSMHotel } from "@/lib/vendors/osm";
import { resolveHotelImage } from "@/lib/hotelImageFree";
import { hotelDedupKey } from "@/lib/dedupeKey";
import { resolveExisting } from "@/lib/hotelIdentity";

export const runtime = "nodejs";
export const maxDuration = 300;

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "hotel";
}

async function run(city: string) {
  const db = getServerSupabase();
  if (!db) return { error: "Supabase not configured" } as const;

  const found = await osmSearchHotels(city);
  if (!found.length) return { city, found: 0, inserted: 0, images: 0 } as const;

  // Dedup against existing OSM rows.
  const ids = found.map((h) => h.id);
  const have = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db.from("hotels").select("source_id").eq("source", "osm").in("source_id", ids.slice(i, i + 200));
    for (const r of (data || []) as Array<{ source_id: string | null }>) if (r.source_id) have.add(String(r.source_id));
  }

  // Insert new hotels, capturing the new uuid for image attachment.
  const inserted: Array<{ id: string; h: OSMHotel }> = [];
  for (const h of found) {
    if (have.has(h.id)) continue;
    // Cross-source identity gate: don't re-add a hotel that already exists under any source.
    if (h.lat != null && h.lng != null) {
      const existing = await resolveExisting(db, { name: h.name, lat: h.lat, lng: h.lng });
      if (existing) continue;
    }
    const digits = h.id.replace(/\D/g, "") || h.id.replace(/[^a-z0-9]/gi, "");
    const { data, error } = await db
      .from("hotels")
      .insert({
        source: "osm", source_id: h.id, slug: `${slugify(h.name)}-${digits}`.slice(0, 80),
        name: h.name, city: h.city || city, country: h.country || null,
        dedup_key: hotelDedupKey(h.name, h.city || city), // was missing here — every insert keys now
        lat: h.lat, lng: h.lng, website: h.website || null, address: h.address || null, stars: h.stars ?? null,
      })
      .select("id")
      .single();
    if (!error && data) inserted.push({ id: String((data as { id: string }).id), h });
  }

  // Resolve free photos (concurrency 6, time-bounded) so vision scoring has evidence.
  let images = 0;
  const deadline = Date.now() + 230_000;
  for (let i = 0; i < inserted.length && Date.now() < deadline; i += 6) {
    const batch = inserted.slice(i, i + 6);
    await Promise.all(batch.map(async ({ id, h }) => {
      try {
        const r = await resolveHotelImage({ name: h.name, website: h.website, wikidata: h.wikidata, imageTag: h.imageTag, lat: h.lat, lng: h.lng, city: h.city || city });
        if (r.source !== "placeholder") { await db.from("hotel_images").insert({ hotel_id: id, url: r.url, attributions: r.attribution ?? null }); images++; }
      } catch {}
    }));
  }

  return { city, found: found.length, inserted: inserted.length, images } as const;
}

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city")?.trim();
  if (!city) return NextResponse.json({ error: "pass ?city=" }, { status: 400 });
  const res = await run(city);
  return NextResponse.json(res, { status: "error" in res ? 500 : 200 });
}

// Vision QA sweep: classify each stored hotel image (Claude Haiku) and clean the junk that
// URL filtering can't catch — logos, review badges, maps, casino shots. Checked once, stored
// on hotel_images.vision_*, served forever. Bad image → try to REPLACE it with a different
// real photo (re-resolve, skipping the bad URL) and re-check that; keep only if it passes.
//
//   GET /api/cron/vision-qa?limit=100      classify up to N unchecked images (max 500)
//        &dry=1                            list what WOULD be processed; spend nothing
//        &noreplace=1                      reject bad images without trying a replacement
//
// Resumable + idempotent: only rows with vision_checked_at IS NULL are touched, so each run
// advances. Run repeatedly (or on a cron) until processed=0.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { classifyHotelImage } from "@/lib/imageVision";
import { resolveHotelImage } from "@/lib/hotelImageFree";

export const runtime = "nodejs";
export const maxDuration = 300;
export const revalidate = 0;

const COST_PER_CALL = 0.0017; // ~Haiku vision: ~1.5k input + ~30 output tokens
const CONC = 4;

type ImgRow = { id: string; hotel_id: string | null; url: string };
type HotelRow = { id: string; name: string; website: string | null; city: string | null; lat: number | null; lng: number | null };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
  const dry = sp.get("dry") === "1";
  const noReplace = sp.get("noreplace") === "1";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  // Absolutize relative URLs (Places proxy) and decode &amp; so the query string fetches correctly.
  const toAbs = (u: string) => { const d = u.replace(/&amp;/g, "&"); return d.startsWith("/") ? base + d : d; };

  if (dry) {
    // True TOTAL of remaining unchecked images (not just one batch) so we can price the run.
    const { count } = await db
      .from("hotel_images")
      .select("*", { count: "exact", head: true })
      .is("vision_checked_at", null)
      .not("url", "like", "%placehold.co%");
    const { data: sample } = await db
      .from("hotel_images").select("url").is("vision_checked_at", null).not("url", "like", "%placehold.co%").limit(10);
    return NextResponse.json({
      dry: true, remainingUnchecked: count ?? 0,
      estCostUsd: +(((count ?? 0)) * COST_PER_CALL).toFixed(2),
      sample: (sample || []).map((r) => (r as { url: string }).url),
    });
  }

  // Unchecked, real (non-placeholder) images. Placeholders are intentional and already hidden.
  const { data: imgRows, error: e1 } = await db
    .from("hotel_images")
    .select("id,hotel_id,url")
    .is("vision_checked_at", null)
    .not("url", "like", "%placehold.co%")
    .order("id", { ascending: true })
    .limit(limit);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  const images = (imgRows || []) as ImgRow[];
  if (!images.length) return NextResponse.json({ processed: 0, done: true });

  // Hotel detail for the replacement re-resolve (website/coords/name).
  const hotelIds = [...new Set(images.map((r) => r.hotel_id).filter(Boolean) as string[])];
  const hotelById = new Map<string, HotelRow>();
  for (let i = 0; i < hotelIds.length; i += 200) {
    const { data: hs } = await db.from("hotels").select("id,name,website,city,lat,lng").in("id", hotelIds.slice(i, i + 200));
    for (const h of (hs || []) as HotelRow[]) hotelById.set(String(h.id), h);
  }

  let kept = 0, replaced = 0, rejected = 0, calls = 0;
  const stamp = new Date().toISOString();

  for (let i = 0; i < images.length; i += CONC) {
    await Promise.all(images.slice(i, i + CONC).map(async (img) => {
      try {
        const v = await classifyHotelImage(toAbs(img.url)); calls++;
        if (v.ok) {
          await db.from("hotel_images").update({ vision_ok: true, vision_label: v.label, vision_checked_at: stamp }).eq("id", img.id);
          kept++;
          return;
        }
        // Bad image — try ONE replacement (different real photo), then re-check it.
        const h = img.hotel_id ? hotelById.get(String(img.hotel_id)) : null;
        if (!noReplace && h) {
          const r = await resolveHotelImage({ name: h.name, website: h.website, lat: h.lat, lng: h.lng, city: h.city, exclude: [img.url] });
          if (r.source !== "placeholder" && r.url !== img.url) {
            const rv = await classifyHotelImage(toAbs(r.url)); calls++;
            if (rv.ok) {
              await db.from("hotel_images").update({ url: r.url, attributions: r.attribution ?? null, vision_ok: true, vision_label: rv.label, vision_checked_at: stamp }).eq("id", img.id);
              replaced++;
              return;
            }
          }
        }
        // No usable photo — keep the row for audit but mark it hidden from carousels.
        await db.from("hotel_images").update({ vision_ok: false, vision_label: v.label, vision_checked_at: stamp }).eq("id", img.id);
        rejected++;
      } catch {
        // Leave vision_checked_at null so a later run retries (transient API/network error).
      }
    }));
  }

  return NextResponse.json({
    processed: images.length, kept, replaced, rejected,
    claudeCalls: calls, estCostUsd: +(calls * COST_PER_CALL).toFixed(2),
    done: images.length < limit,
  });
}

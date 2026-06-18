import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { claudeCosyScore } from "@/lib/scoring/claudeCosy";

export const runtime = 'nodejs';
export const maxDuration = 300;

const STALE_DAYS = 14;
const CONCURRENCY = 4;

type HotelRow = {
  id: string;
  name: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  rating: number | null;
  reviews_count: number | null;
  rooms_count: number | null;
  amenities: string[] | null;
  description: string | null;
  stars: number | null;
};

type ScoreRow = { hotel_id: string; scored_at: string | null };

async function runBatch(force = false, limit = 100): Promise<{ processed: number; errors: number; ms: number }> {
  const start = Date.now();
  const db = getServerSupabase();
  if (!db) throw new Error("Supabase not configured");

  const { data: existing, error: sErr } = await db
    .from("cosy_scores")
    .select("hotel_id, scored_at");
  if (sErr) throw new Error(sErr.message);

  const scoredAtMap = new Map<string, string | null>(
    ((existing || []) as ScoreRow[]).map((r) => [r.hotel_id, r.scored_at])
  );

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const isStale = (id: string): boolean => {
    if (force) return true;
    const scoredAt = scoredAtMap.get(id);
    if (!scoredAt) return true;
    return scoredAt < cutoff;
  };

  // Page through hotels (deterministic id order) accumulating stale ones until we have
  // `limit`. This converges across runs instead of permanently skipping hotels beyond a
  // fixed window.
  const PAGE = 500;
  const toScore: HotelRow[] = [];
  for (let from = 0; toScore.length < limit; from += PAGE) {
    const { data: page, error: hErr } = await db
      .from("hotels")
      .select("id, name, city, country, website, rating, reviews_count, rooms_count, amenities, description, stars")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (hErr) throw new Error(hErr.message);
    const rows = (page || []) as HotelRow[];
    if (rows.length === 0) break;
    for (const h of rows) {
      if (isStale(h.id)) {
        toScore.push(h);
        if (toScore.length >= limit) break;
      }
    }
    if (rows.length < PAGE) break;
  }

  // Fetch one real photo per hotel for vision scoring (skip placeholders).
  const imgByHotel = new Map<string, string>();
  try {
    const ids = toScore.map((h) => h.id);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", chunk);
      for (const row of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
        const hid = row.hotel_id ? String(row.hotel_id) : "";
        const url = row.url || "";
        if (hid && url && !url.includes("placehold.co") && !imgByHotel.has(hid)) imgByHotel.set(hid, url);
      }
    }
  } catch {}

  let processed = 0;
  let errors = 0;

  // Process with a concurrency pool of CONCURRENCY
  for (let i = 0; i < toScore.length; i += CONCURRENCY) {
    const batch = toScore.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (h) => {
        try {
          const r = await claudeCosyScore({
            name: h.name ?? undefined,
            city: h.city ?? undefined,
            country: h.country ?? undefined,
            website: h.website ?? undefined,
            rating: h.rating ?? undefined,
            reviewsCount: h.reviews_count ?? undefined,
            roomsCount: h.rooms_count ?? undefined,
            amenities: (h.amenities as string[] | null) ?? undefined,
            description: h.description ?? undefined,
            stars: h.stars ?? undefined,
            imageUrls: imgByHotel.get(h.id) ? [imgByHotel.get(h.id) as string] : undefined,
          });
          const now = new Date().toISOString();
          const { error: uErr } = await db.from("cosy_scores").upsert(
            {
              hotel_id: h.id,
              score: r.score10,
              raw_score: r.score10,
              score_100: r.score100,
              signals: r.signals,
              penalties: r.penalties,
              description: r.description,
              confidence: r.confidence,
              score_model: r.model,
              scored_at: now,
              computed_at: now,
            },
            { onConflict: "hotel_id" }
          );
          if (uErr) throw new Error(uErr.message);
          processed++;
        } catch (e) {
          try { console.error("recompute_scores_hotel_error", h.id, e); } catch {}
          errors++;
        }
      })
    );
  }

  return { processed, errors, ms: Date.now() - start };
}

export async function POST(req: Request) {
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100;

  try {
    const result = await runBatch(force, limit);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100;

  after(async () => {
    try { await runBatch(force, limit); } catch (e) { try { console.error("recompute_scores_error", e); } catch {} }
  });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { claudeCosyScore, type ClaudeCosyInput } from "@/lib/scoring/claudeCosy";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = 'nodejs';
export const maxDuration = 300;

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
  slug: string | null;
};

const STALE_DAYS = 14;

async function scoreHotelRow(db: SupabaseClient, h: HotelRow): Promise<void> {
  // Fetch up to 10 review snippets
  const { data: reviewRows } = await db
    .from("hotel_reviews")
    .select("text")
    .eq("hotel_id", h.id)
    .limit(10);
  const reviews = ((reviewRows || []) as Array<{ text: string | null }>)
    .map((r) => r.text)
    .filter((t): t is string => typeof t === "string" && t.length > 0);

  const input: ClaudeCosyInput = {
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
    reviews: reviews.length ? reviews : undefined,
  };

  const r = await claudeCosyScore(input);
  const now = new Date().toISOString();

  const { error } = await db.from("cosy_scores").upsert(
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
  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const city = url.searchParams.get("city");

  let hotels: HotelRow[] = [];

  if (slug) {
    const { data, error } = await db
      .from("hotels")
      .select("id, name, city, country, website, rating, reviews_count, rooms_count, amenities, description, stars, slug")
      .eq("slug", slug)
      .limit(1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    hotels = (data || []) as HotelRow[];
  } else if (city) {
    const { data, error } = await db
      .from("hotels")
      .select("id, name, city, country, website, rating, reviews_count, rooms_count, amenities, description, stars, slug")
      .ilike("city", city);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    hotels = (data || []) as HotelRow[];
  } else {
    // Score all stale hotels (no scored_at or older than 14 days)
    const { data: allHotels, error: hErr } = await db
      .from("hotels")
      .select("id, name, city, country, website, rating, reviews_count, rooms_count, amenities, description, stars, slug")
      .limit(500);
    if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

    const { data: existing } = await db
      .from("cosy_scores")
      .select("hotel_id, scored_at");
    const scoredAtMap = new Map<string, string | null>(
      ((existing || []) as Array<{ hotel_id: string; scored_at: string | null }>).map((r) => [r.hotel_id, r.scored_at])
    );
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    hotels = ((allHotels || []) as HotelRow[]).filter((h) => {
      const scoredAt = scoredAtMap.get(h.id);
      if (!scoredAt) return true;
      return scoredAt < cutoff;
    });
  }

  let processed = 0;
  let errors = 0;

  const CONCURRENCY = 4;
  for (let i = 0; i < hotels.length; i += CONCURRENCY) {
    const batch = hotels.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (h) => {
        try {
          await scoreHotelRow(db, h);
          processed++;
        } catch (e) {
          try { console.error("admin_score_hotel_error", h.id, e); } catch {}
          errors++;
        }
      })
    );
  }

  return NextResponse.json({ processed, errors });
}

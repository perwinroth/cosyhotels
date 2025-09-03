import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cosyScore } from "@/lib/scoring/cosy";

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const start = Date.now();
  const { data: hotels, error } = await supabase.from("hotels").select("id, rating, reviews_count, rooms_count, amenities, description");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates = (hotels || []).map((h) => ({
    hotel_id: h.id,
    score: cosyScore({
      rating: h.rating ?? undefined,
      reviewsCount: h.reviews_count ?? undefined,
      roomsCount: h.rooms_count ?? undefined,
      amenities: (h.amenities as string[] | null) ?? undefined,
      description: h.description ?? undefined,
    }),
    amenities_score: null,
    review_sentiment: null,
    imagery_warmth: null,
    scale_penalty: null,
    notes: null,
    computed_at: new Date().toISOString(),
  }));

  // Upsert scores
  if (updates.length) {
    const { error: upErr } = await supabase.from("cosy_scores").upsert(updates, { onConflict: "hotel_id" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ processed: updates.length, ms: Date.now() - start });
}


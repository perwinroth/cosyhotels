import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cosyParts } from "@/lib/scoring/cosy";

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const start = Date.now();
  const { data: hotels, error } = await supabase.from("hotels").select("id, name, city, website, rating, reviews_count, rooms_count, amenities, description");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const updates = (hotels || []).map((h) => {
    const { raw, parts } = cosyParts({
      name: h.name ?? undefined,
      website: h.website ?? undefined,
      city: h.city ?? undefined,
      rating: h.rating ?? undefined,
      reviewsCount: h.reviews_count ?? undefined,
      roomsCount: h.rooms_count ?? undefined,
      amenities: (h.amenities as string[] | null) ?? undefined,
      description: h.description ?? undefined,
    });
    return {
      hotel_id: h.id,
      // Keep legacy 'score' for UI, write raw_score too; normalization job will fill calibrated
      score: raw,
      raw_score: raw,
      calibrated_score: null,
      rating_base: parts.rating_base,
      amenities_score: parts.amenities,
      keyword_score: parts.keywords,
      imagery_warmth: parts.image_warmth,
      scale_penalty: parts.scale_penalty,
      chain_penalty: parts.chain_penalty,
      review_conf: parts.review_conf,
      computed_at: new Date().toISOString(),
    } as {
      hotel_id: string;
      score: number;
      raw_score: number;
      calibrated_score: number | null;
      rating_base: number;
      amenities_score: number;
      keyword_score: number;
      imagery_warmth: number;
      scale_penalty: number;
      chain_penalty: number;
      review_conf: number;
      computed_at: string;
    };
  });

  // Upsert scores
  if (updates.length) {
    const { error: upErr } = await supabase.from("cosy_scores").upsert(updates, { onConflict: "hotel_id" });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ processed: updates.length, ms: Date.now() - start });
}

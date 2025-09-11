import { NextResponse } from "next/server";
import { hotels as baseHotels } from "@/data/hotels";
import { cosyScore } from "@/lib/scoring/cosy";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  let up = 0;
  for (const h of baseHotels) {
    const { data, error } = await supabase
      .from("hotels")
      .upsert({
        source: "curated",
        source_id: h.id,
        slug: h.slug,
        name: h.name,
        address: null,
        city: h.city,
        country: h.country,
        lat: null,
        lng: null,
        rating: h.rating,
        reviews_count: null,
        rooms_count: null,
        amenities: h.amenities,
        description: h.description,
        website: null,
        affiliate_url: h.affiliateUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error || !data) continue;
    const score = cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description });
    await supabase.from("cosy_scores").upsert({ hotel_id: data.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
    up++;
  }
  return NextResponse.json({ upserted: up });
}

export async function GET() { return POST(); }


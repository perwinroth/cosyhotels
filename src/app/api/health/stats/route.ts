import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // Count hotels
  const { count: hotelsCount } = await supabase.from("hotels").select("id", { count: "exact", head: true });
  // Count all scores
  const { count: scoresCount } = await supabase.from("cosy_scores").select("hotel_id", { count: "exact", head: true });
  // Count thresholds
  const { count: over7 } = await supabase.from("cosy_scores").select("hotel_id", { count: "exact", head: true }).gte("score", 7.0);
  const { count: over75 } = await supabase.from("cosy_scores").select("hotel_id", { count: "exact", head: true }).gte("score", 7.5);
  const { count: over8 } = await supabase.from("cosy_scores").select("hotel_id", { count: "exact", head: true }).gte("score", 8.0);

  return NextResponse.json({
    hotels: hotelsCount ?? null,
    scores: scoresCount ?? null,
    thresholds: { over7: over7 ?? null, over75: over75 ?? null, over8: over8 ?? null },
  });
}


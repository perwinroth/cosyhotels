import { NextResponse } from "next/server";
// Curated hotels removed; rely on Supabase image cache and Places
// import { getImageForHotel } from "@/lib/hotelImages";

export async function GET() {
  const hasKey = !!process.env.GOOGLE_MAPS_API_KEY;
  if (!hasKey) return NextResponse.json({ ok: false, error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  // Curated list removed; nothing to precache here
  return NextResponse.json({ ok: true, cached: 0, failed: 0 });
}

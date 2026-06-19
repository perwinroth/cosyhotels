// Returns the next ready-to-publish Pinterest pin payload for an n8n/Make → Blotato flow.
// Uses the shared cityPin builder so it stays in sync with the /posts gallery and published pins.
//   GET /api/social/next?after=<city>   (optional cursor to advance)
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { populatedCities, cityPin } from "@/lib/social";

export const runtime = "nodejs";
export const revalidate = 0;

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const after = new URL(req.url).searchParams.get("after")?.trim().toLowerCase() || "";
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const cities = await populatedCities(db);
  if (!cities.length) return NextResponse.json({ error: "no populated cities yet" }, { status: 404 });

  let idx = 0;
  if (after) {
    const i = cities.findIndex((c) => c.city.toLowerCase() === after);
    idx = i >= 0 ? (i + 1) % cities.length : 0;
  }
  const pin = await cityPin(db, cities[idx].city, base);
  return NextResponse.json({ ...pin, nextCursor: pin.city });
}

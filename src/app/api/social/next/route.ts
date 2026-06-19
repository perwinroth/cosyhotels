// Returns the next ready-to-publish Pinterest pin payload for an n8n/Make → Blotato flow.
// Rotates through populated cities (tier order, most hotels first). The image + UTM link +
// copy are everything a publisher needs. Later: the learning loop reorders by performance.
//   GET /api/social/next?after=<city>   (optional cursor to advance)
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityToSlug } from "@/lib/citySlug";

export const runtime = "nodejs";
export const revalidate = 0;

function lc(s: string) { return s.toLowerCase(); }

export async function GET(req: Request) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const after = new URL(req.url).searchParams.get("after")?.trim() || "";
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // Populated cities (have surfaced hotels), tier order then most scored.
  const { data } = await db.from("populate_state").select("city,tier,hotels_scored,status").eq("status", "done").order("tier").order("hotels_scored", { ascending: false });
  const cities = (data || []) as Array<{ city: string; tier: number; hotels_scored: number }>;
  if (!cities.length) return NextResponse.json({ error: "no populated cities yet" }, { status: 404 });

  let idx = 0;
  if (after) {
    const i = cities.findIndex((c) => lc(c.city) === lc(after));
    idx = i >= 0 ? (i + 1) % cities.length : 0;
  }
  const c = cities[idx];
  const slug = cityToSlug(c.city);
  const link = `${base}/en/guides/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=city-${slug.replace(/-cosy-hotel$/, "")}`;
  const cityTag = c.city.toLowerCase().replace(/[^a-z0-9]/g, "");

  return NextResponse.json({
    city: c.city,
    imageUrl: `${base}/api/social/pin?city=${encodeURIComponent(c.city)}`,
    title: `Cosy Hotels in ${c.city}: AI-Rated Boutique Stays`,
    description: `The cosiest hotels in ${c.city}, ranked by AI for warmth, character and intimacy — not just stars. Tap for the full ranking with cosy scores and to check availability. #cosyhotels #${cityTag}hotels #boutiquehotels #${cityTag}travel #romanticgetaway`,
    link,
    board: "Cosy Hotels in Europe",
    tags: ["cosy hotels", `${c.city} hotels`, "boutique hotels", "romantic getaway", "travel"],
    nextCursor: c.city,
  });
}

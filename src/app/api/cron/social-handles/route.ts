// Resolve social handles for FEATURED hotels (cosy score >= 5 — the ones that appear in
// city carousels) from each hotel's own website, and cache on `hotels`. Published carousels
// then @mention them → the hotel reposts "we're a top cosy stay in {city}" → free reach.
// Free (website scrape, no API key). Resumable: only rows with social_checked_at IS NULL.
//
//   GET /api/cron/social-handles?limit=100   resolve up to N (max 500)
//        &city=Paris                         scope to one city
//        &dry=1                              count what's left, do nothing
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { resolveHotelSocial } from "@/lib/hotelSocial";

export const runtime = "nodejs";
export const maxDuration = 300;
export const revalidate = 0;

const CONC = 6;
type Row = { id: string; name: string | null; website: string | null };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
  const city = sp.get("city")?.trim() || "";
  const dry = sp.get("dry") === "1";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  // Drive by cosy_scores in SCORE ORDER (same selection as the carousel) so the hotels we
  // actually feature get handles first — not arbitrary score>=5 hotels. Unchecked + has website.
  const base = () => {
    let q = db
      .from("cosy_scores")
      .select("hotel:hotel_id!inner(id,name,website,city,social_checked_at)", dry ? { count: "exact", head: true } : {})
      .gte("score", 5)
      .is("hotel.social_checked_at", null)
      .not("hotel.website", "is", null)
      .order("score", { ascending: false });
    if (city) q = q.ilike("hotel.city", `%${city}%`);
    return q;
  };

  if (dry) {
    const { count } = await base();
    return NextResponse.json({ dry: true, remaining: count ?? 0 });
  }

  const { data, error } = await base().limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const r of (data || []) as unknown as Array<{ hotel: Row | null }>) {
    const h = r.hotel;
    if (!h?.id || seen.has(h.id)) continue;
    seen.add(h.id);
    rows.push(h);
  }
  if (!rows.length) return NextResponse.json({ processed: 0, done: true });

  const stamp = new Date().toISOString();
  let withIg = 0, withAny = 0;
  for (let i = 0; i < rows.length; i += CONC) {
    await Promise.all(rows.slice(i, i + CONC).map(async (h) => {
      const s = await resolveHotelSocial(h.website);
      if (s.instagram) withIg++;
      if (s.instagram || s.facebook || s.tiktok) withAny++;
      await db
        .from("hotels")
        .update({ instagram: s.instagram, facebook: s.facebook, tiktok: s.tiktok, threads: s.threads, social_checked_at: stamp })
        .eq("id", h.id);
    }));
  }

  return NextResponse.json({ processed: rows.length, withInstagram: withIg, withAnySocial: withAny, done: rows.length < limit });
}

// Shared pin-payload builder so the /posts gallery, /api/social/next, and what gets published
// all read the same source and produce identical pins. Server-only (uses Supabase).
import type { getServerSupabase } from "@/lib/supabase/server";
import { cityToSlug } from "@/lib/citySlug";

type DB = NonNullable<ReturnType<typeof getServerSupabase>>;

// One hotel in the carousel/reel: its REAL photo + cosy score. Blotato turns slides[] into
// the published carousel (one card per hotel). `instagram` is enriched downstream by n8n
// (search the hotel's official handle from name+city) so the post can @mention them → repost.
export type Slide = {
  name: string;
  city: string;
  score: number;
  photo: string;
  instagram: string | null;
};

export type CityPin = {
  city: string;
  imageUrl: string;     // legacy satori text card — cover/fallback only, NOT the carousel
  slides: Slide[];      // the real-photo carousel content (top cosy hotels WITH a real photo)
  title: string;
  description: string;
  link: string;
  board: string;
  tags: string[];
  items: string[];
};

export async function populatedCities(db: DB): Promise<Array<{ city: string; tier: number; hotels_scored: number }>> {
  const { data } = await db
    .from("populate_state")
    .select("city,tier,hotels_scored,status")
    .eq("status", "done")
    .order("tier")
    .order("hotels_scored", { ascending: false });
  return (data || []) as Array<{ city: string; tier: number; hotels_scored: number }>;
}

export async function cityPin(db: DB, city: string, base: string): Promise<CityPin> {
  const slug = cityToSlug(city);
  const cityTag = city.toLowerCase().replace(/[^a-z0-9]/g, "");
  const link = `${base}/en/guides/${slug}?utm_source=pinterest&utm_medium=social&utm_campaign=city-${slug.replace(/-cosy-hotel$/, "")}`;

  // Pull more candidates than we need (24) so we can keep the top 5 that actually have a real
  // photo — a photo-led carousel is what earns saves/reposts; a text card gets scrolled past.
  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, hotel:hotel_id!inner(name, city, instagram)")
    .gte("score", 5)
    .ilike("hotel.city", `%${city}%`)
    .order("score", { ascending: false })
    .limit(24);
  const seen = new Set<string>();
  const candidates: Array<{ id: string; name: string; score: number; instagram: string | null }> = [];
  for (const r of (data || []) as unknown as Array<{ hotel_id: string | null; score: number | null; score_final: number | null; hotel: { name: string; instagram: string | null } | null }>) {
    const nm = (r.hotel?.name || "").replace(/[|~]/g, " ").trim();
    if (!nm || !r.hotel_id || seen.has(nm)) continue;
    seen.add(nm);
    const sc = (typeof r.score_final === "number" ? r.score_final : Number(r.score)) || 0;
    const ig = r.hotel?.instagram ? `@${String(r.hotel.instagram).replace(/^@/, "")}` : null;
    candidates.push({ id: String(r.hotel_id), name: nm, score: sc, instagram: ig });
  }

  // Real photos for those hotels (newest first; skip placeholders).
  const photoById = new Map<string, string>();
  const ids = candidates.map((c) => c.id);
  if (ids.length) {
    const { data: imgRows } = await db
      .from("hotel_images")
      .select("hotel_id,url,created_at")
      .in("hotel_id", ids)
      // Hide images the vision QA confirmed as junk (vision_ok=false); keep unchecked (null) + good.
      .or("vision_ok.is.null,vision_ok.is.true")
      .order("created_at", { ascending: false });
    for (const row of (imgRows || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : "";
      const url = row.url ? String(row.url) : "";
      if (!hid || !url || url.includes("placehold.co")) continue;
      if (!photoById.has(hid)) photoById.set(hid, url);
    }
  }

  // Top 5 cosy hotels that HAVE a real photo → the carousel.
  const slides: Slide[] = [];
  for (const c of candidates) {
    const photo = photoById.get(c.id);
    if (!photo) continue;
    slides.push({ name: c.name, city, score: c.score, photo, instagram: c.instagram });
    if (slides.length >= 5) break;
  }

  // Legacy text-card lines: prefer the slide hotels, else fall back to top scored candidates.
  const itemsSource = slides.length ? slides : candidates.slice(0, 5);
  const items = itemsSource.map((s) => `${s.name}~${s.score.toFixed(1)}`);
  const itemsParam = items.length ? `&items=${encodeURIComponent(items.join("|"))}` : "";

  return {
    city,
    imageUrl: `${base}/api/social/pin?city=${encodeURIComponent(city)}${itemsParam}`,
    slides,
    title: `Cosy Hotels in ${city}: AI-Rated Boutique Stays`,
    description: `The cosiest hotels in ${city}, ranked by AI for warmth, character and intimacy — not just stars. Tap for the full ranking with cosy scores and to check availability. #cosyhotels #${cityTag}hotels #boutiquehotels #${cityTag}travel #romanticgetaway`,
    link,
    board: "Cosy Hotels in Europe",
    tags: ["cosy hotels", `${city} hotels`, "boutique hotels", "romantic getaway", "travel"],
    items,
  };
}

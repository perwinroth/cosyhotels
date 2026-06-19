// Shared pin-payload builder so the /posts gallery, /api/social/next, and what gets published
// all read the same source and produce identical pins. Server-only (uses Supabase).
import type { getServerSupabase } from "@/lib/supabase/server";
import { cityToSlug } from "@/lib/citySlug";

type DB = NonNullable<ReturnType<typeof getServerSupabase>>;

export type CityPin = {
  city: string;
  imageUrl: string;
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

  const { data } = await db
    .from("cosy_scores")
    .select("score, score_final, hotel:hotel_id!inner(name, city)")
    .gte("score", 5)
    .ilike("hotel.city", `%${city}%`)
    .order("score", { ascending: false })
    .limit(8);
  const seen = new Set<string>();
  const items: string[] = [];
  for (const r of (data || []) as unknown as Array<{ score: number | null; score_final: number | null; hotel: { name: string } | null }>) {
    const nm = (r.hotel?.name || "").replace(/[|~]/g, " ").trim();
    if (!nm || seen.has(nm)) continue;
    seen.add(nm);
    const sc = (typeof r.score_final === "number" ? r.score_final : Number(r.score)) || 0;
    items.push(`${nm}~${sc.toFixed(1)}`);
    if (items.length >= 5) break;
  }
  const itemsParam = items.length ? `&items=${encodeURIComponent(items.join("|"))}` : "";

  return {
    city,
    imageUrl: `${base}/api/social/pin?city=${encodeURIComponent(city)}${itemsParam}`,
    title: `Cosy Hotels in ${city}: AI-Rated Boutique Stays`,
    description: `The cosiest hotels in ${city}, ranked by AI for warmth, character and intimacy — not just stars. Tap for the full ranking with cosy scores and to check availability. #cosyhotels #${cityTag}hotels #boutiquehotels #${cityTag}travel #romanticgetaway`,
    link,
    board: "Cosy Hotels in Europe",
    tags: ["cosy hotels", `${city} hotels`, "boutique hotels", "romantic getaway", "travel"],
    items,
  };
}

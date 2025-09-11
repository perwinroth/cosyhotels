import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchText, getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import slugify from "slugify";

// A diverse set of seed queries across languages to cast a wide global net
const QUERIES = [
  "cosy boutique hotel",
  "cozy boutique hotel",
  "charming hotel",
  "romantic hotel",
  "hygge hotel",
  "boutique hotel cosy",
  // Localized synonyms
  "hôtel de charme",
  "hotel con encanto",
  "hotel romantico",
  "hotel romântico",
  "gemütliches hotel",
  "koseligt hotel",
  "mysigt hotell",
  "hyggelig hotel",
];

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });

  const seen = new Set<string>();
  let upserted = 0;
  let scanned = 0;
  for (const q of QUERIES) {
    let page: string | undefined = undefined;
    for (let i = 0; i < 3; i++) {
      const data = await searchText(q, page);
      page = data.next_page_token;
      const batch = (data.results || []).slice(0, 20);
      for (const r of batch) {
        if (seen.has(r.place_id)) continue;
        seen.add(r.place_id);
        scanned++;
        const d = await getDetails(r.place_id);
        if (!d) continue;
        const slug = slugify(d.name || r.place_id, { lower: true, strict: true });
        const parts = (d.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
        const cityName = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || "");
        const country = parts.length ? parts[parts.length - 1] : '';
        const summary = d.editorial_summary?.overview || d.formatted_address || '';
        const am: string[] = [];
        const sLower = summary.toLowerCase();
        if (sLower.includes("spa")) am.push("Spa");
      if (sLower.includes("sauna")) am.push("Sauna");
      if (sLower.includes("fireplace")) am.push("Fireplace");
      if (sLower.includes("bath")) am.push("Bathtub");
      if (sLower.includes("rooftop")) am.push("Rooftop");
      if (sLower.includes("garden")) am.push("Garden");
      if (sLower.includes("bar")) am.push("Bar");
      if (sLower.includes("restaurant")) am.push("Restaurant");

      const { data: hotel, error } = await supabase
        .from("hotels")
        .upsert({
          source: "google-places",
          source_id: d.place_id,
          slug,
          name: d.name,
          address: d.formatted_address || null,
          city: cityName,
          country,
          lat: d.geometry?.location.lat ?? null,
          lng: d.geometry?.location.lng ?? null,
          rating: d.rating ? Number((d.rating * 2).toFixed(1)) : null,
          reviews_count: d.user_ratings_total ?? null,
          rooms_count: null,
          amenities: am.length ? am : null,
          description: summary || null,
          website: d.website || null,
          affiliate_url: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "slug" })
        .select("id")
        .single();
      if (error || !hotel) continue;

      const score = cosyScore({ rating: d.rating ? d.rating * 2 : undefined, amenities: am, description: `${d.name}. ${summary}` });
      await supabase.from("cosy_scores").upsert({ hotel_id: hotel.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
      upserted++;
      }
      if (!page) break;
    }
  }

  return NextResponse.json({ scanned, upserted });
}

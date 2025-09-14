import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchText, getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import slugify from "slugify";

// Import or copy from main refresh route (kept in sync)
const QUERIES = [
  "cosy boutique hotel","cozy boutique hotel","charming boutique hotel","romantic boutique hotel",
  "hôtel de charme","hotel con encanto","hotel romantico","gemütliches hotel","koseligt hotel","mysigt hotell","hyggelig hotel",
];
const COUNTRIES = [
  "France","Spain","Italy","Portugal","Germany","United Kingdom","Ireland","Netherlands","Belgium","Luxembourg",
  "Switzerland","Austria","Denmark","Sweden","Norway","Finland","Iceland","Czechia","Poland","Hungary",
  "Slovakia","Slovenia","Croatia","Greece","Turkey","Romania","Bulgaria","Ukraine",
  "United States","Canada","Mexico","Costa Rica","Brazil","Argentina","Chile","Peru","Colombia",
  "Morocco","South Africa","Kenya","Tanzania",
  "UAE","Israel","Jordan","Japan","South Korea","Thailand","Vietnam","Malaysia","Singapore","Indonesia","Philippines",
  "India","Sri Lanka","Australia","New Zealand",
];

const MAX_SCANNED = 2000;
const PAGES = 3;

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });
  const db = supabase;

  const day = new Date().getUTCDay(); // 0..6
  const slice = (arr: string[], parts: number, idx: number) => arr.filter((_, i) => i % parts === idx);
  const dailyCountries = slice(COUNTRIES, 7, day);
  const dailyQueries = slice(QUERIES, 7, day).concat(QUERIES.slice(0, 2));

  let scanned = 0, upserted = 0, skipped = 0;
  const seen = new Set<string>();
  const shouldStop = () => scanned >= MAX_SCANNED;

  async function fetchQ(q: string) {
    let page: string | undefined;
    for (let i = 0; i < PAGES; i++) {
      if (shouldStop()) return;
      const data = await searchText(q, page);
      page = data.next_page_token;
      const batch = (data.results || []).slice(0, 20);
      for (const r of batch) {
        if (shouldStop()) break;
        if (seen.has(r.place_id)) continue;
        seen.add(r.place_id);
        scanned++;
        const d = await getDetails(r.place_id);
        if (!d) { skipped++; continue; }

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

        const { data: hotel, error } = await db
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
        if (error || !hotel) { skipped++; continue; }

        const score = cosyScore({ rating: d.rating ? d.rating * 2 : undefined, amenities: am, description: `${d.name}. ${summary}` });
        await db.from("cosy_scores").upsert({ hotel_id: hotel.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
        upserted++;
      }
      if (!page) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  for (const c of dailyCountries) {
    if (shouldStop()) break;
    for (const q of dailyQueries) {
      if (shouldStop()) break;
      await fetchQ(`${q} in ${c}`);
    }
  }

  try { console.info(JSON.stringify({ refreshTopDaily: { scanned, upserted, skipped, day } })); } catch {}
  return NextResponse.json({ scanned, upserted, skipped, day });
}

export async function GET() { return POST(); }
export const runtime = 'nodejs';
export const maxDuration = 180; // shorter daily batches

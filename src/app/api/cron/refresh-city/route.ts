import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchText, getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import { generateHotelSlug } from "@/lib/slug";

const QUERIES = [
  "cosy boutique hotel","cozy boutique hotel","charming boutique hotel","romantic boutique hotel",
  // Common EU languages to widen coverage
  "hôtel de charme","hôtel cosy","hotel con encanto","albergo di charme","hotel romantico",
  "gemütliches hotel","mysigt hotell","hyggeligt hotel","gezellig hotel",
];

const MAX_SCANNED_DEFAULT = 600;
const PAGES_DEFAULT = 3;

type CityResult = { scanned: number; upserted: number; skipped: number; city: string; country?: string } | { error: string };

async function runForCity(city: string, country?: string, opts?: { max?: number; pages?: number }): Promise<CityResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { error: "Supabase not configured" } as const;
  if (!process.env.GOOGLE_MAPS_API_KEY) return { error: "GOOGLE_MAPS_API_KEY not set" } as const;
  const db = supabase;

  const MAX = opts?.max ?? MAX_SCANNED_DEFAULT;
  const PAGES = Math.min(5, Math.max(1, opts?.pages ?? PAGES_DEFAULT));

  let scanned = 0, upserted = 0, skipped = 0;
  const seen = new Set<string>();
  const shouldStop = () => scanned >= MAX;

  async function fetchCityQuery(q: string) {
    let page: string | undefined;
    for (let i = 0; i < PAGES; i++) {
      if (shouldStop()) return;
      const data = await searchText(q, page);
      page = data.next_page_token;
      const batch = (data.results || []).slice(0, 20);
      for (const r of batch) {
        if (shouldStop()) break;
        if (!r.place_id || seen.has(r.place_id)) continue;
        seen.add(r.place_id);
        scanned++;
        const d = await getDetails(r.place_id);
        if (!d) { skipped++; continue; }
        const types = (d.types || []).map((t) => t.toLowerCase());
        if (types.some((t) => ["hostel","capsule_hotel","apartment","apartment_hotel"].includes(t))) { skipped++; continue; }
        const parts = (d.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
        const cityName = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || city);
        const countryName = parts.length ? parts[parts.length - 1] : (country || '');
        const slug = await generateHotelSlug(db, d.name || r.place_id, cityName, countryName);
        const summary = d.editorial_summary?.overview || d.formatted_address || '';
        const am: string[] = [];
        const sLower = summary.toLowerCase();
        if (sLower.includes("spa")) am.push("Spa");
        if (sLower.includes("sauna")) am.push("Sauna");
        if (sLower.includes("onsen") || sLower.includes("hot spring")) am.push("Onsen");
        if (sLower.includes("ryokan")) am.push("Ryokan");
        if (sLower.includes("tatami")) am.push("Tatami");
        if (sLower.includes("machiya")) am.push("Machiya");
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
            country: countryName,
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

        const score = cosyScore({ rating: d.rating ? d.rating * 2 : undefined, amenities: am, description: `${d.name}. ${summary}`, name: d.name, website: d.website, reviewsCount: d.user_ratings_total ?? undefined, city: cityName });
        await db.from("cosy_scores").upsert({ hotel_id: hotel.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
        upserted++;
      }
      if (!page) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  for (const q of QUERIES) {
    if (shouldStop()) break;
    await fetchCityQuery(`${q} in ${city}`);
  }

  return { scanned, upserted, skipped, city, country };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city");
  const country = url.searchParams.get("country") || undefined;
  const pages = url.searchParams.get("pages");
  const max = url.searchParams.get("max");
  if (!city) return NextResponse.json({ error: "Missing ?city" }, { status: 400 });
  // Schedule heavy work in background and return immediately to avoid timeouts
  after(async () => {
    try {
      await runForCity(city, country, { pages: pages ? Number(pages) : undefined, max: max ? Number(max) : undefined });
    } catch (e) { try { console.error('refresh-city GET background error', e); } catch {} }
  });
  return NextResponse.json({ scheduled: true, city }, { status: 202 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const city = url.searchParams.get("city");
  const country = url.searchParams.get("country") || undefined;
  const pages = url.searchParams.get("pages");
  const max = url.searchParams.get("max");
  if (!city) return NextResponse.json({ error: "Missing ?city" }, { status: 400 });
  after(async () => { try { await runForCity(city, country, { pages: pages ? Number(pages) : undefined, max: max ? Number(max) : undefined }); } catch (e) { try { console.error('refresh-city error', e); } catch {} } });
  return NextResponse.json({ scheduled: true, city }, { status: 202 });
}

export const runtime = 'nodejs';
export const maxDuration = 180;

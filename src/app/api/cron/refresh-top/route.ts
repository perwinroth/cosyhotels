import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchText, getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import slugify from "slugify";

// A diverse set of seed queries across languages to cast a wide global net
const QUERIES = [
  // English
  "cosy boutique hotel",
  "cozy boutique hotel",
  "charming boutique hotel",
  "romantic boutique hotel",
  "small cosy hotel",
  "intimate boutique hotel",
  // Localized synonyms
  "hôtel de charme",
  "hôtel cosy",
  "hotel con encanto",
  "hotel romantico",
  "hotel romântico",
  "gemütliches hotel",
  "kleines gemütliches hotel",
  "koseligt hotel",
  "mysigt hotell",
  "hyggelig hotel",
  "accogliente hotel",
  "boutique hotel acogedor",
];

// Regions and areas to expand coverage beyond major cities
const REGIONS = [
  "Europe","Asia","North America","South America","Africa","Oceania","Caribbean","Mediterranean","Alps",
  "Scandinavia","Baltics","Balkans","Iberia","British Isles","Middle East","Southeast Asia","East Asia","Central Europe",
  "Benelux","Andes","Patagonia","Riviera","Tuscany","Provence","Peloponnese","Aegean","Adriatic","New England",
  "Pacific Northwest","Yucatán","Yosemite","Dolomites","Tatra","Cotswolds","Lake District","Highlands","Sicily","Sardinia",
];

// Limits to avoid exhausting API quotas in a single run (raised per request)
const MAX_SCANNED = 5000; // total place ids to evaluate per run
const PAGES_GENERAL = 4;  // pages to fetch for each general query
const PAGES_REGION = 3;   // pages to fetch for each region-qualified query
const PAGES_COUNTRY = 2;  // pages to fetch for each country-qualified query

// Broad country list to increase global coverage
const COUNTRIES = [
  // Europe
  "France","Spain","Italy","Portugal","Germany","United Kingdom","Ireland","Netherlands","Belgium","Luxembourg",
  "Switzerland","Austria","Denmark","Sweden","Norway","Finland","Iceland","Czechia","Poland","Hungary",
  "Slovakia","Slovenia","Croatia","Bosnia and Herzegovina","Serbia","Montenegro","Albania","Greece","Turkey",
  "Romania","Bulgaria","Moldova","Ukraine","Lithuania","Latvia","Estonia","Malta","Cyprus",
  // Americas
  "United States","Canada","Mexico","Costa Rica","Panama","Jamaica","Dominican Republic","Brazil","Argentina","Chile",
  "Peru","Colombia","Ecuador","Uruguay",
  // Africa
  "Morocco","Tunisia","Egypt","South Africa","Kenya","Tanzania","Namibia",
  // Middle East & Asia
  "United Arab Emirates","Israel","Jordan","Lebanon","Saudi Arabia",
  "Japan","South Korea","China","Taiwan","Thailand","Vietnam","Cambodia","Laos","Malaysia","Singapore","Indonesia","Philippines",
  "India","Sri Lanka","Nepal",
  // Oceania
  "Australia","New Zealand",
];

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });

  const seen = new Set<string>();
  let upserted = 0;
  let scanned = 0;
  const shouldStop = () => scanned >= MAX_SCANNED;

  // Helper to fetch several pages for a query
  async function fetchQuery(q: string, pages: number) {
    let page: string | undefined = undefined;
    for (let i = 0; i < pages; i++) {
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
      // Small delay helps next_page_token activate and spreads out API usage
      await new Promise((res) => setTimeout(res, 1500));
    }
  }

  // 1) Broad global queries
  for (const q of QUERIES) {
    if (shouldStop()) break;
    await fetchQuery(q, PAGES_GENERAL);
  }
  // 2) Region-qualified queries (e.g., "cosy boutique hotel in Alps")
  for (const region of REGIONS) {
    if (shouldStop()) break;
    for (const q of QUERIES.slice(0, 4)) { // top few to limit permutations
      if (shouldStop()) break;
      await fetchQuery(`${q} in ${region}`, PAGES_REGION);
    }
  }
  // 3) Country-qualified queries (e.g., "cozy boutique hotel in Japan")
  for (const country of COUNTRIES) {
    if (shouldStop()) break;
    for (const q of QUERIES.slice(0, 3)) { // most productive variants
      if (shouldStop()) break;
      await fetchQuery(`${q} in ${country}`, PAGES_COUNTRY);
    }
  }

  return NextResponse.json({ scanned, upserted });
}

export async function GET() {
  // Convenience: allow triggering from browser for testing
  return POST();
}

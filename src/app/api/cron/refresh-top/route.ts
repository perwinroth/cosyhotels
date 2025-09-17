import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { searchText, getDetails } from "@/lib/places";
import { cosyScore } from "@/lib/scoring/cosy";
import { computeAndPersistNormalizerStats, normalizedScore } from "@/lib/normalization";
import { getImageForHotel } from "@/lib/hotelImages";
import { generateHotelSlug } from "@/lib/slug";
import { cities } from "@/data/cities";
import { citiesLarge } from "@/data/cities_large";
import { cityGuides } from "@/data/cityGuides";

// A diverse set of seed queries across languages to cast a wide global net
const QUERIES = [
  // English
  "cosy boutique hotel","cozy boutique hotel","charming boutique hotel","romantic boutique hotel",
  "small boutique hotel","intimate boutique hotel","chic boutique hotel","design hotel",
  // Localized synonyms
  "hôtel de charme","hôtel cosy","maison d'hôtes de charme",
  "hotel con encanto","hotel romantico","hotel romântico",
  "gemütliches hotel","kleines hotel","kleines gemütliches hotel",
  "gezellig hotel","knus hotel","hyggeligt hotel","mysigt hotell","koselig hotell",
  "accogliente hotel","boutique hotel acogedor","ryokan","minshuku",
];

// Regions and areas to expand coverage beyond major cities
const REGIONS = [
  "Europe","Asia","North America","South America","Africa","Oceania","Caribbean","Mediterranean","Alps",
  "Scandinavia","Baltics","Balkans","Iberia","British Isles","Middle East","Southeast Asia","East Asia","Central Europe",
  "Benelux","Andes","Patagonia","Riviera","Tuscany","Provence","Peloponnese","Aegean","Adriatic","New England",
  "Pacific Northwest","Yucatán","Yosemite","Dolomites","Tatra","Cotswolds","Lake District","Highlands","Sicily","Sardinia",
];

// Limits to avoid exhausting API quotas in a single run (raised per request)
const MAX_SCANNED = 8000; // total place ids to evaluate per run
const PAGES_GENERAL = 5;  // pages to fetch for each general query
const PAGES_REGION = 4;   // pages to fetch for each region-qualified query
const PAGES_COUNTRY = 3;  // pages to fetch for each country-qualified query
const PAGES_CITY = 2;     // pages to fetch for each specific city

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

async function runJob() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const db = supabase; // non-null beyond this point
  if (!process.env.GOOGLE_MAPS_API_KEY) return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY not set" }, { status: 500 });

  const seen = new Set<string>();
  let upserted = 0;
  let scanned = 0;
  let skipped = 0;
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
        if (!d) { skipped++; continue; }
        // Type filtering: skip non-hotel patterns
        const types = (d.types || []).map((t) => t.toLowerCase());
        if (types.some((t) => ["hostel","capsule_hotel","apartment","apartment_hotel"].includes(t))) { skipped++; continue; }
        const parts = (d.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
        const cityName = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || "");
        const country = parts.length ? parts[parts.length - 1] : '';
        const slug = await generateHotelSlug(db, d.name || r.place_id, cityName, country);
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
      if (error || !hotel) continue;

      const score = cosyScore({ rating: d.rating ? d.rating * 2 : undefined, amenities: am, description: `${d.name}. ${summary}` , name: d.name, website: d.website, reviewsCount: d.user_ratings_total ?? undefined, city: cityName });
      await db.from("cosy_scores").upsert({ hotel_id: hotel.id, score, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
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
  // 4) Deterministic sweep across major world cities
  const ALL_CITIES = Array.from(new Set([...(cities || []), ...(citiesLarge || [])]));
  for (const city of ALL_CITIES) {
    if (shouldStop()) break;
    await fetchQuery(`cosy boutique hotel in ${city}`, PAGES_CITY);
  }

  // Log useful totals to server logs for Vercel
  try { console.info(JSON.stringify({ refreshTop: { scanned, upserted, skipped } })); } catch {}
  try {
    await computeAndPersistNormalizerStats();
    type Row = { score: number; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; website: string | null; reviews_count: number | null } | null };
    const { data } = await db
      .from("cosy_scores")
      .select("score, hotel:hotel_id (id,slug,name,city,country,website,reviews_count)")
      .gte("score", 7)
      .order("score", { ascending: false })
      .limit(300);
    const rows = (data || []) as unknown as Row[];
    const { data: stats } = await db.from("normalizer_stats").select("scope,key,median,iqr");
    const cityStats = new Map<string, { m: number; i: number }>();
    const countryStats = new Map<string, { m: number; i: number }>();
    ((stats as unknown as { scope: string; key: string; median: number; iqr: number }[]) || []).forEach((s) => {
      if (s.scope === 'city') cityStats.set(s.key, { m: Number(s.median), i: Number(s.iqr) });
      if (s.scope === 'country') countryStats.set(s.key, { m: Number(s.median), i: Number(s.iqr) });
    });
    const CHAINS = [
      "marriott","hilton","hyatt","accor","radisson","kempinski","four seasons","ritz-carlton","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham","premier inn","travelodge",
    ];
    const brandOf = (name: string, website?: string) => {
      const hay = `${name} ${website || ''}`.toLowerCase();
      for (const c of CHAINS) if (hay.includes(c)) return c;
      return "independent";
    };
    const perCountry: Record<string, number> = {};
    const perBrand: Record<string, number> = {};
    // Relaxed diversity guard to ensure 9 picks while DB grows
    const maxCountry = 4, maxBrand = 3;
    const scored = rows.map((r) => {
      const h = r.hotel;
      if (!h) return null;
      const base = Number(r.score) || 0;
      const cs = cityStats.get(String(h.city || '')) || { m: base, i: 1 };
      const ks = countryStats.get(String(h.country || '')) || { m: base, i: 1 };
      const normCity = normalizedScore(base, cs.m, cs.i);
      const normCountry = normalizedScore(base, ks.m, ks.i);
      const reviews = typeof (h.reviews_count as number | null) === 'number' ? (h.reviews_count as number) : 0;
      const conf = Math.max(0.6, Math.min(1.0, Math.log10(1 + reviews) / 2));
      const final = (0.5 * base + 0.3 * normCity + 0.2 * normCountry) * conf;
      return { hotel: h, base, final };
    }).filter(Boolean) as Array<{ hotel: NonNullable<Row['hotel']>; base: number; final: number }>;
    scored.sort((a, b) => b.final - a.final);
    const picked: typeof scored = [];
    for (const s of scored) {
      const country = String(s.hotel.country || '');
      const brand = brandOf(s.hotel.name, s.hotel.website || undefined);
      const cCount = perCountry[country] || 0;
      const bCount = perBrand[brand] || 0;
      if (cCount >= maxCountry || bCount >= maxBrand) continue;
      picked.push(s);
      perCountry[country] = cCount + 1;
      perBrand[brand] = bCount + 1;
      if (picked.length >= 9) break;
    }
    const toInsert = picked.length >= 9 ? picked.slice(0,9) : scored.slice(0,9);
    await db.from("featured_top").delete().neq("position", -1);
    const inserts = toInsert.map((p, idx) => ({ position: idx + 1, hotel_id: p.hotel.id, score: p.final, image_url: "/seal.svg" }));
    if (inserts.length) await db.from("featured_top").insert(inserts);
  } catch (e) { try { console.error("normalization_or_featured_error", e); } catch {} }
  // 5) Precompute top-9 per city for guides
  try {
    type RowHotel = {
      id: string;
      slug: string;
      name: string;
      city: string | null;
      country: string | null;
      rating: number | null;
      reviews_count: number | null;
      source_id: string | null;
      cosy_scores: { score: number | null; score_final: number | null } | Array<{ score: number | null; score_final: number | null }> | null;
    };
    const guideCities = Array.from(new Set(cityGuides.map((c) => c.city)));
    for (const city of guideCities) {
      const { data: rows } = await db
        .from('hotels')
        .select('id,slug,name,city,country,rating,reviews_count,source_id, cosy_scores ( score, score_final )')
        .ilike('city', `%${city}%`)
        .limit(200);
      const safeRows = (rows || []) as RowHotel[];
      const scored = safeRows
        .map((r) => {
          const cs = Array.isArray(r.cosy_scores) ? r.cosy_scores[0] : r.cosy_scores;
          const s = cs ? Number((cs.score_final ?? cs.score) || 0) : 0;
          return { h: r, s };
        })
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 9);
      const inserts: Array<{ city: string; rank: number; hotel_id: string; score: number; image_url: string; rating5: number | null; reviews_count: number | null; cues: string[]; updated_at: string }>= [];
      let rank = 1;
      for (const { h, s } of scored) {
        let rating5: number | null = h.rating ? Number(h.rating) / 2 : null;
        let reviews = h.reviews_count || null;
        const cues: string[] = [];
        try {
          if (h.source_id) {
            const d = await getDetails(h.source_id);
            if (d) {
              rating5 = d.rating ?? rating5;
              reviews = (d.user_ratings_total ?? reviews) as number | null;
              const txt = `${d.editorial_summary?.overview || ''} ${d.formatted_address || ''}`.toLowerCase();
              if (txt.includes('spa')) cues.push('spa');
              if (txt.includes('sauna')) cues.push('sauna');
              if (txt.includes('bathtub') || txt.includes('soaking') || txt.includes('bath')) cues.push('tubs');
              if (txt.includes('fireplace')) cues.push('fireplace');
              if (txt.includes('garden')) cues.push('garden');
              if (txt.includes('rooftop')) cues.push('rooftop');
            }
          }
        } catch {}
        const image_url = await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id)) || '/seal.svg';
        inserts.push({ city, rank, hotel_id: h.id, score: s, image_url, rating5: rating5 ?? null, reviews_count: reviews ?? null, cues, updated_at: new Date().toISOString() });
        rank++;
      }
      await db.from('city_top').delete().eq('city', city);
      if (inserts.length) await db.from('city_top').insert(inserts);
    }
  } catch (e) { try { console.error('city_top_error', e); } catch {} }
  return { scanned, upserted, skipped };
}

export async function POST() {
  // Kick work to background so we return quickly to the caller (Cron)
  after(async () => {
    try {
      await runJob();
    } catch (err) {
      try { console.error("refresh-top background error", err); } catch {}
    }
  });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

export async function GET() {
  // Convenience: allow triggering from browser for testing
  return POST();
}
export const runtime = 'nodejs';
export const maxDuration = 300; // allow up to 5 minutes for broad sweeps

import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityGuides } from "@/data/cityGuides";
import { bboxFor } from "@/data/cityCoords";

type HB = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  rating: number | null;
  address?: string | null;
  reviews_count?: number | null;
  source?: string | null;
  source_id?: string | null;
};

type CS = { hotel_id: string; score: number | null; score_final: number | null };

const CHAINS = [
  "marriott","hilton","hyatt","accor","radisson","kempinski","four seasons","ritz-carlton","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham","premier inn","travelodge",
];

const brandOf = (name: string) => {
  const hay = name.toLowerCase();
  for (const c of CHAINS) if (hay.includes(c)) return c; return 'independent';
};

function norm(s: string) { return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase(); }

const LOCAL_SYNONYMS: Record<string, string[]> = {
  'New York': ['New York City','NYC','Manhattan'],
  'New York City': ['New York','NYC','Manhattan'],
  'San Francisco': ['San Fransisco','Bay Area'],
  'Prague': ['Praha'],
  'Florence': ['Firenze'],
  'Venice': ['Venezia'],
  'Copenhagen': ['København'],
  'Reykjavik': ['Reykjavík'],
  'Quebec City': ['Québec','Quebec'],
  'Porto': ['Oporto'],
  'Rome': ['Roma'],
  'Milan': ['Milano'],
  'Turin': ['Torino'],
  'Naples': ['Napoli'],
  'Genoa': ['Genova'],
  'Cologne': ['Köln'],
  'Munich': ['München'],
  'Vienna': ['Wien'],
  'Seville': ['Sevilla'],
  'Brussels': ['Bruxelles','Brussel'],
  'Bruges': ['Brugge'],
  'Athens': ['Athína','Athina'],
  'Kyoto': ['京都市','京都'],
  'Tokyo': ['東京','Tōkyō'],
};

export async function GET() {
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  const results: Array<{
    city: string;
    slug: string;
    candidates: number;
    unique_by_source_or_sig: number;
    have_scores: number;
    cosy_ge_7: number;
    chosen_9_algo: number;
    brand_caps_applied: boolean;
  }> = [];

  for (const g of cityGuides) {
    const base = g.city.trim();
    const variants = new Set<string>([base, ...(LOCAL_SYNONYMS[base] || [])]);
    const orCity = Array.from(variants).map((v) => `city.ilike.%${v}%`).join(',');
    const orAddr = Array.from(variants).map((v) => `address.ilike.%${v}%`).join(',');

    let { data: hRows } = await db
      .from('hotels')
      .select('id,slug,name,city,country,rating,address,reviews_count,source,source_id')
      .or(`${orCity},${orAddr}`)
      .limit(1000);
    let hotels: HB[] = ((hRows || []) as HB[]).filter(Boolean);
    if (hotels.length < 100) {
      const bb = bboxFor(g.city);
      if (bb) {
        const { data: geoRows } = await db
          .from('hotels')
          .select('id,slug,name,city,country,rating,address,reviews_count,source,source_id,lat,lng')
          .gte('lat', bb.minLat)
          .lte('lat', bb.maxLat)
          .gte('lng', bb.minLng)
          .lte('lng', bb.maxLng)
          .limit(2000);
        const geoHotels: HB[] = ((geoRows || []) as HB[]).filter(Boolean);
        hotels = [...hotels, ...geoHotels];
      }
    }
    const candidates = hotels.length;

    const ids = hotels.map((h) => String(h.id));
    const { data: sRows } = await db
      .from('cosy_scores')
      .select('hotel_id,score,score_final')
      .in('hotel_id', ids);
    const scoreMap = new Map<string, number>();
    for (const r of ((sRows || []) as CS[])) {
      const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
      if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
    }
    const have_scores = scoreMap.size;

    // Dedup by source_id when present, else by normalized name|city|country
    const seenId = new Set<string>();
    const identKey = (h: HB) => h.source_id ? `src:${h.source_id}` : `${norm(String(h.name))}|${norm(String(h.city || ''))}|${norm(String(h.country || ''))}`;
    const uniq: HB[] = hotels.filter((h: HB) => { const k = identKey(h); if (seenId.has(k)) return false; seenId.add(k); return true; });
    const unique_by_source_or_sig = uniq.length;

    const vnorm = Array.from(variants).map((v) => norm(v));
    const scored: Array<{ h: HB; s: number; exact: number; mention: number; tie: number; brand: string }> = uniq.map((h: HB) => {
      const s = scoreMap.get(String(h.id)) ?? 0;
      const cityN = norm(String(h.city || ''));
      const addrN = norm(String(h.address || ''));
      const exact = vnorm.includes(cityN) ? 2 : 0;
      const mention = vnorm.some((v) => addrN.includes(v)) ? 1 : 0;
      const tie = typeof h.reviews_count === 'number' ? Math.min(1, Number(h.reviews_count) / 1000) : 0;
      return { h, s, exact, mention, tie, brand: brandOf(h.name) };
    });

    const cosy_ge_7 = scored.filter((x) => x.s >= 7.0).length;

    const sorted = scored
      .sort((a, b) => (b.exact - a.exact) || (b.mention - a.mention) || (b.s - a.s) || (b.tie - a.tie));

    // Apply brand caps and pick 9
    const perBrand: Record<string, number> = {};
    const picks: typeof sorted = [];
    const primary = sorted.filter((x) => x.s >= 7.0);
    for (const x of primary) {
      const bc = perBrand[x.brand] || 0;
      if (bc >= 2 && x.brand !== 'independent') continue;
      perBrand[x.brand] = bc + 1;
      picks.push(x);
      if (picks.length >= 9) break;
    }
    if (picks.length < 9) {
      for (const x of sorted) {
        if (picks.length >= 9) break;
        if (picks.includes(x)) continue;
        const bc = perBrand[x.brand] || 0;
        if (bc >= 2 && x.brand !== 'independent') continue;
        perBrand[x.brand] = bc + 1;
        picks.push(x);
      }
    }
    results.push({
      city: g.city,
      slug: g.slug,
      candidates,
      unique_by_source_or_sig,
      have_scores,
      cosy_ge_7,
      chosen_9_algo: picks.length,
      brand_caps_applied: true,
    });
  }

  return NextResponse.json({ results });
}

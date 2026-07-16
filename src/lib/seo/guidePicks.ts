// Shared "does this city guide have at least one live pick" computation. Extracted verbatim from
// src/app/[locale]/guides/[slug]/page.tsx (2026-07-16 internal-link audit) so every place that
// decides whether to LINK a city guide (curated or slug-derived/"fabricated") can verify existence
// with the IDENTICAL predicate the guide page renders with, instead of a lookalike query that can
// drift and mint a link the page then 404s.
//
// Why a lookalike query is not safe here: `hotels.city` is frequently polluted (OSM scrape
// artifacts): trailing postcodes ("Bali 80571", "Windermere LA23 3JA"), province/postal codes
// standing in for the city ("QC J8X 1Z6", "V93 KHN6"), or hyphenated place names that don't
// round-trip through the slug's space-based prettification ("Chantemerle-lès-Grignan" vs the
// slug-recovered "Chantemerle Les Grignan"). The guide page's own TRUST filter requires an EXACT
// (accent/case-folded) match between a hotel's raw city field and one of the guide's city-name
// variants, deliberately stricter than the sitemap/hub/facet-page substring match
// (`src/lib/seo/cityHotels.ts`'s `cityMembers`), which is why `liveCosyCountForCityName` /
// `loadCityCosyHotels` are NOT reliable existence checks for these slug-derived guides: they can
// report a city as "live" via substring match while the guide page's stricter filter finds zero
// picks. Verified against production for the 2026-07-16 audit's 12 broken guide links.
import { getDelistedSlugSet } from "@/lib/delisted";
import { badLinkHotelIds } from "@/lib/linkQuality";
import { sameHotel } from "@/lib/hotelIdentity";
import { isLatin } from "@/lib/placeText";
import { cityExonymVariants } from "@/lib/exonyms";
import { bboxFor } from "@/data/cityCoords";
import { aliasCity } from "@/lib/seo/cityHotels";
import type { getServerSupabase } from "@/lib/supabase/server";

type DB = NonNullable<ReturnType<typeof getServerSupabase>>;

export type GuideHotelRow = {
  id: string; slug: string; name: string; name_en?: string | null; city: string | null; country: string | null;
  rating: number | null; address?: string | null; reviews_count?: number | null;
  source?: string | null; source_id?: string | null; lat?: number | null; lng?: number | null;
  website?: string | null;
};
type ScoreRow = { hotel_id: string; score: number | null; score_final: number | null };

export type GuidePick = { h: GuideHotelRow; s: number; exact: number; mention: number; tie: number; rank: number; brand: string };

export type GuidePicksResult = {
  sorted: GuidePick[];
  picks: GuidePick[];
  scoreQueryFailed: boolean;
  signalsMap: Map<string, string[]>;
  descMap: Map<string, string>;
};

// Same-name local variants the page recognizes (accented/alternate spellings that hotels may be
// stored under). Kept here verbatim; if the page's list changes, mirror it here.
const LOCAL_SYNONYMS: Record<string, string[]> = {
  'New York': ['New York City', 'NYC', 'Manhattan'],
  'New York City': ['New York', 'NYC', 'Manhattan'],
  'San Francisco': ['San Fransisco', 'Bay Area'],
  'Prague': ['Praha'],
  'Florence': ['Firenze'],
  'Venice': ['Venezia'],
  'Copenhagen': ['København'],
  'Reykjavik': ['Reykjavík'],
  'Quebec City': ['Québec', 'Quebec'],
  'Lucerne': ['Luzern'],
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
  'Brussels': ['Bruxelles', 'Brussel'],
  'Bruges': ['Brugge'],
  'Athens': ['Athína', 'Athina'],
  'Kyoto': ['京都市', '京都'],
  'Tokyo': ['東京', 'Tōkyō'],
};

const CHAINS = [
  'marriott', 'hilton', 'hyatt', 'accor', 'radisson', 'kempinski', 'four seasons', 'ritz-carlton',
  'intercontinental', 'sheraton', 'ibis', 'novotel', 'mercure', 'holiday inn', 'best western',
  'wyndham', 'premier inn', 'travelodge',
];
function brandOf(name: string): string {
  const hay = name.toLowerCase();
  for (const c of CHAINS) if (hay.includes(c)) return c;
  return 'independent';
}

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// PUBLIC GATE (two-score model): the secret 0-100 Claude score lives in cosy_scores.score_100
// (never surfaced). Anything below 50/100 (= 5.0/10) is "hidden", kept in the DB for later
// re-review/upgrade, but never shown.
export const COSY_FLOOR = 5.0; // = 50/100 public gate

/**
 * Fetch + rank + gate a city's cosy hotels EXACTLY as the guide page does, so the page and every
 * link generator that decides whether to link a guide share one predicate. Mirrors
 * src/app/[locale]/guides/[slug]/page.tsx's inline computation (ilike pool -> bbox top-up -> RPC
 * accent top-up -> exact-variant TRUST filter -> COSY_FLOOR -> dedup/brand-cap). A change to the
 * page's matching logic must be mirrored here (and vice versa).
 */
export async function computeGuidePicks(db: DB, cityName: string): Promise<GuidePicksResult> {
  const base = cityName.trim();
  const vset = new Set<string>([base]);
  // The slug->city fallback prettifies "aix-en-provence" to "Aix En Provence" (spaces), but hotels
  // store "Aix-en-Provence" (hyphens), so add both separator forms.
  vset.add(base.replace(/\s+/g, '-'));
  vset.add(base.replace(/-/g, ' '));
  for (const alt of (LOCAL_SYNONYMS[base] || [])) vset.add(alt);
  for (const v of cityExonymVariants(base)) vset.add(v);

  const orCity = Array.from(vset).map((v) => `city.ilike.%${v}%`).join(',');
  const orAddr = Array.from(vset).map((v) => `address.ilike.%${v}%`).join(',');
  const { data: hRows } = await db
    .from('hotels')
    .select('id,slug,name,name_en,city,country,rating,address,reviews_count,source,source_id,lat,lng,website')
    .or(`${orCity},${orAddr}`)
    .limit(800);
  let hotels = ((hRows || []) as GuideHotelRow[]).filter(Boolean);

  if (hotels.length < 100) {
    const bb = bboxFor(cityName);
    if (bb) {
      const { data: geoRows } = await db
        .from('hotels')
        .select('id,slug,name,name_en,city,country,rating,address,reviews_count,source,source_id,lat,lng,website')
        .gte('lat', bb.minLat)
        .lte('lat', bb.maxLat)
        .gte('lng', bb.minLng)
        .lte('lng', bb.maxLng)
        .limit(1200);
      const geoHotels = ((geoRows || []) as GuideHotelRow[]).filter(Boolean);
      hotels = [...hotels, ...geoHotels];
    }
  }

  try {
    const { data: rpcRows } = await db.rpc('cosy_city_hotels', { q: aliasCity(cityName) });
    for (const r of ((rpcRows || []) as Array<Record<string, unknown>>)) {
      if (!r.hotel_id || !r.slug) continue;
      hotels.push({
        id: String(r.hotel_id), slug: String(r.slug), name: String(r.name || ''),
        name_en: (r.name_en as string | null) ?? null, city: (r.city as string | null) ?? null,
        country: (r.country as string | null) ?? null, rating: null, address: null,
        reviews_count: null, source: null, source_id: null,
        lat: (r.lat as number | null) ?? null, lng: (r.lng as number | null) ?? null,
      });
    }
  } catch { /* RPC failure is non-fatal; the ilike/bbox pool still stands */ }

  const bad = await badLinkHotelIds(db);
  const delisted = await getDelistedSlugSet(db);
  const ids = hotels.map((h) => String(h.id));
  const scoreMap = new Map<string, number>();
  const signalsMap = new Map<string, string[]>();
  const descMap = new Map<string, string>();
  let scoreQueryFailed = false;
  for (let i = 0; i < ids.length; i += 150) {
    const { data: sRows, error: sErr } = await db
      .from('cosy_scores')
      .select('hotel_id,score,score_final,signals,description')
      .in('hotel_id', ids.slice(i, i + 150));
    if (sErr) { scoreQueryFailed = true; console.error('cosy_scores query failed (chunk):', sErr.message); }
    for (const r of ((sRows || []) as Array<ScoreRow & { signals: string[] | null; description: string | null }>)) {
      const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
      if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
      if (r.hotel_id && Array.isArray(r.signals)) signalsMap.set(String(r.hotel_id), r.signals);
      if (r.hotel_id && typeof r.description === 'string' && r.description.trim()) descMap.set(String(r.hotel_id), r.description.trim());
    }
  }

  const variants = Array.from(vset).map((v) => norm(v));
  const seenId = new Set<string>();
  const scored: GuidePick[] = hotels.filter((h) => {
    if (bad.has(String(h.id))) return false;
    if (delisted.has(String(h.slug))) return false; // takedown excludes listing surfaces
    if (seenId.has(String(h.id))) return false;
    seenId.add(String(h.id));
    // TRUST: drop hotels whose named city differs from this guide's city.
    const hc = norm(String(h.city || ''));
    if (hc && !variants.includes(hc)) return false;
    return true;
  }).map((h) => {
    const s = scoreMap.get(String(h.id)) ?? 0;
    const city = norm(String(h.city || ''));
    const addr = norm(String(h.address || ''));
    const exact = variants.includes(city) ? 2 : 0;
    const mention = variants.some((v) => addr.includes(v)) ? 1 : 0;
    const tie = typeof h.reviews_count === 'number' ? Math.min(1, Number(h.reviews_count) / 1000) : 0;
    const confirmed = exact === 2 || mention === 1;
    const rank = confirmed ? s : s - 1.0;
    return { h, s, exact, mention, tie, rank, brand: brandOf(h.name) };
  });
  const sorted = scored.sort((a, b) => (b.rank - a.rank) || (b.s - a.s) || (b.tie - a.tie));

  const perBrand: Record<string, number> = {};
  const seen = new Set<string>();
  const picks: GuidePick[] = [];
  for (const x of sorted) {
    if (x.s < COSY_FLOOR) continue;
    if (!isLatin(String(x.h.name_en || x.h.name))) continue;
    const key = String(x.h.slug);
    if (seen.has(key)) continue;
    if (picks.some((p) => sameHotel(p.h, x.h).same)) continue;
    const bc = perBrand[x.brand] || 0;
    if (bc >= 2 && x.brand !== 'independent') continue;
    seen.add(key);
    perBrand[x.brand] = bc + 1;
    picks.push(x);
    if (picks.length >= 12) break;
  }

  return { sorted, picks, scoreQueryFailed, signalsMap, descMap };
}

/**
 * True when the guide for `cityName` would render at least one live pick (score >= 5). Fails OPEN
 * (assumes it exists) when the DB is unavailable or the score query fails transiently, matching the
 * guide page's own behavior of rendering a "temporarily unavailable" state rather than 404ing on a
 * blip. Use this, not `liveCosyCountForCityName`, before linking a slug-derived (non-curated)
 * city guide; see the module comment above for why the substring-based count is not sufficient.
 */
export async function guideCityHasLivePick(db: DB | null, cityName: string): Promise<boolean> {
  if (!db) return true;
  const { picks, scoreQueryFailed } = await computeGuidePicks(db, cityName);
  return picks.length > 0 || scoreQueryFailed;
}

import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
// using precomputed city_top; no direct Places calls
import { buildCosySnippet } from "@/i18n/snippets";
import Image from "next/image";
import { getImageForHotel } from "@/lib/hotelImages";
import { notFound } from "next/navigation";
// import { cosyScore } from "@/lib/scoring/cosy";
import { translate } from "@/lib/i18n/translate";
import { locales } from "@/i18n/locales";
import { bboxFor } from "@/data/cityCoords";

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = getGuide(params.slug);
  if (!g) {
    const cg = getCityGuide(params.slug);
    if (cg) {
      const titleBase = `${cg.city} cosy hotels – 9 handpicked stays`;
      const descBase = `Our favourite cosy and romantic boutique hotels in ${cg.city}.`;
      const title = params.locale === 'en' ? titleBase : await translate(titleBase, params.locale);
      const description = params.locale === 'en' ? descBase : await translate(descBase, params.locale);
      const url = `/${params.locale}/guides/${cg.slug}`;
      const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${cg.slug}`]));
      return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary", title, description } };
    }
    return {};
  }
  const url = `/${params.locale}/guides/${g.slug}`;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${g.slug}`]));
  const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
  const description = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary", title, description },
  };
}

export default async function GuidePage({ params }: Props) {
  const g = getGuide(params.slug);
  if (g) {
    const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
    const excerpt = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
    return (
      <article className="prose prose-zinc mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2">{title}</h1>
        <p className="text-zinc-600">{excerpt}</p>
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: g.body }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: title, description: excerpt, mainEntityOfPage: { '@type': 'WebPage', '@id': `/guides/${g.slug}` } }),
          }}
        />
      </article>
    );
  }
  let cg = getCityGuide(params.slug);
  if (!cg) {
    const slug = params.slug.toLowerCase();
    // Only allow lightweight fallback for city-style slugs ending with -cosy-hotel
    if (!slug.endsWith('-cosy-hotel')) {
      notFound();
    }
    const aliases: Record<string, string> = {
      'new-york-cosy-hotel': 'New York', 'nyc-cosy-hotel': 'New York', 'new-york-city-cosy-hotel': 'New York',
      'san-francisco-cosy-hotel': 'San Francisco', 'sf-cosy-hotel': 'San Francisco',
      'los-angeles-cosy-hotel': 'Los Angeles', 'la-cosy-hotel': 'Los Angeles',
    };
    const base = slug.replace(/-cosy-hotel$/, '');
    const pretty = aliases[slug] || base.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    cg = { city: pretty, slug: params.slug } as unknown as ReturnType<typeof getCityGuide>;
  }
  const cityName = String((cg as { city: string }).city);

  // Source guide hotels from Supabase with robust city matching and diversity
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  type HB = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; address?: string | null; reviews_count?: number | null; source?: string | null; source_id?: string | null };
  type CS = { hotel_id: string; score: number | null; score_final: number | null };
  // Build robust variants for the city (handles common local names)
  const base = cityName.trim();
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const vset = new Set<string>([base]);
  const localSynonyms: Record<string, string[]> = {
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
  for (const alt of (localSynonyms[base] || [])) vset.add(alt);
  // Query by city or address containing any variant
  const orCity = Array.from(vset).map((v) => `city.ilike.%${v}%`).join(',');
  const orAddr = Array.from(vset).map((v) => `address.ilike.%${v}%`).join(',');
  let { data: hRows } = await db
    .from('hotels')
    .select('id,slug,name,city,country,rating,address,reviews_count,source,source_id')
    .or(`${orCity},${orAddr}`)
    .limit(800);
  let hotels = ((hRows || []) as HB[]).filter(Boolean);
  // If the text match pool is small, widen with a lat/lng bounding box around the city center
  if (hotels.length < 100) {
    const bb = bboxFor(cityName);
    if (bb) {
      const { data: geoRows } = await db
        .from('hotels')
        .select('id,slug,name,city,country,rating,address,reviews_count,source,source_id,lat,lng')
        .gte('lat', bb.minLat)
        .lte('lat', bb.maxLat)
        .gte('lng', bb.minLng)
        .lte('lng', bb.maxLng)
        .limit(1200);
      const geoHotels = ((geoRows || []) as HB[]).filter(Boolean);
      hotels = [...hotels, ...geoHotels];
    }
  }
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
  // Score and prioritize exact city matches, apply basic chain diversity to avoid duplicates
  const chains = [
    'marriott','hilton','hyatt','accor','radisson','kempinski','four seasons','ritz-carlton','intercontinental','sheraton','ibis','novotel','mercure','holiday inn','best western','wyndham','premier inn','travelodge',
  ];
  const brandOf = (name: string) => {
    const hay = name.toLowerCase();
    for (const c of chains) if (hay.includes(c)) return c; return 'independent';
  };
  const variants = Array.from(vset).map((v) => norm(v));
  const identKey = (h: HB) => {
    const base = h.source_id ? `src:${h.source_id}` : `${norm(String(h.name))}|${norm(String(h.city || ''))}|${norm(String(h.country || ''))}`;
    return base;
  };
  const seenId = new Set<string>();
  const scored = hotels.filter((h) => {
    const k = identKey(h);
    if (seenId.has(k)) return false;
    seenId.add(k);
    return true;
  }).map((h) => {
    const s = scoreMap.get(String(h.id)) ?? 0;
    const city = norm(String(h.city || ''));
    const addr = norm(String(h.address || ''));
    const exact = variants.includes(city) ? 2 : 0;
    const mention = variants.some((v) => addr.includes(v)) ? 1 : 0;
    const tie = typeof h.reviews_count === 'number' ? Math.min(1, Number(h.reviews_count) / 1000) : 0;
    return { h, s, exact, mention, tie, brand: brandOf(h.name) };
  });
  const sorted = scored
    .sort((a, b) => (b.exact - a.exact) || (b.mention - a.mention) || (b.s - a.s) || (b.tie - a.tie));
  const primary = sorted.filter((x) => x.s >= 7.0);
  const perBrand: Record<string, number> = {};
  const seen = new Set<string>();
  const picks: typeof sorted = [];
  // First pass: cosy >= 7.0 with brand cap
  for (const x of primary) {
    const key = String(x.h.slug);
    if (seen.has(key)) continue;
    const bc = perBrand[x.brand] || 0;
    if (bc >= 2 && x.brand !== 'independent') continue;
    seen.add(key);
    perBrand[x.brand] = bc + 1;
    picks.push(x);
    if (picks.length >= 9) break;
  }
  // Second pass: top remaining regardless of score to guarantee 9 from our dataset
  if (picks.length < 9) {
    for (const x of sorted) {
      if (picks.length >= 9) break;
      const key = String(x.h.slug);
      if (seen.has(key)) continue;
      const bc = perBrand[x.brand] || 0;
      if (bc >= 2 && x.brand !== 'independent') continue;
      seen.add(key);
      perBrand[x.brand] = bc + 1;
      picks.push(x);
    }
  }
  const take = picks;
  const chosen = await Promise.all(take.map(async ({ h, s }) => {
    const img = (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || '/seal.svg';
    const snippet = buildCosySnippet(params.locale, {
      city: String(h.city || cityName),
      name: String(h.name),
      cosy: s,
      rating: typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined,
      reviewsCount: undefined,
      cues: [],
      idealLevel: 'warm',
    });
    return { slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), rating: 0, _cosy: s, _img: img, snippet };
  }))

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{cityName} cosy hotels</h1>
      <p className="mt-2 text-zinc-600">9 handpicked cosy and romantic stays in {cityName}.</p>
      <ol className="mt-6 space-y-6">
        {chosen.map((h, idx) => (
          <li key={`${h.slug}-${h._img}`} className="border border-zinc-200 rounded-xl bg-white">
            <div className="p-3 md:p-4">
              <div className="flex items-baseline gap-3">
                <div className="text-xl font-semibold tabular-nums">{idx + 1}.</div>
                <h2 className="text-xl font-semibold">
                  <a href={detailsHref(h.slug)} className="hover:underline">{h.name}</a>
                </h2>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{h.snippet}</p>
            </div>
            <a href={detailsHref(h.slug)}>
              <div className="relative w-full aspect-[4/3] rounded-b-xl overflow-hidden">
                <Image src={h._img} alt={`${h.name} – ${h.city}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 1200px" />
              </div>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
export const revalidate = 600;

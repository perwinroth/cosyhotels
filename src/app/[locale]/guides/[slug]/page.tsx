import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
// using precomputed city_top; no direct Places calls
import { buildCosySnippet } from "@/i18n/snippets";
import Image from "next/image";
import { messages as i18n } from "@/i18n/messages";
import { bookingSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";
import { notFound } from "next/navigation";
// import { cosyScore } from "@/lib/scoring/cosy";
import { translate } from "@/lib/i18n/translate";
import { locales } from "@/i18n/locales";
import { bboxFor } from "@/data/cityCoords";

type Props = { params: { slug: string; locale: string } };

// City-specific FAQ for GEO/SEO. Answers are method-based and honest — they describe how
// we score cosiness rather than asserting unverifiable local facts.
function cityFaqs(city: string): Array<{ q: string; a: string }> {
  return [
    {
      q: `What makes a hotel in ${city} cosy?`,
      a: `Cosiness is about warmth, intimacy and character: small room counts, fireplaces or soaking tubs, natural materials like wood and stone, and reviews where guests feel genuinely welcomed rather than processed. We rank ${city} hotels on exactly these signals.`,
    },
    {
      q: `How are these ${city} hotels ranked?`,
      a: `Each hotel gets a 0–10 cosy score from our scoring engine, which weighs property type and scale, amenities, the language guests use in reviews, and the setting. Independent and boutique stays tend to score higher than large chains.`,
    },
    {
      q: `Are cosy hotels in ${city} more expensive than chain hotels?`,
      a: `Not necessarily. Cosiness comes from character and scale, not price — many of the cosiest stays are small independents that cost less than a big-brand business hotel.`,
    },
    {
      q: `Can I book these ${city} hotels directly?`,
      a: `Yes. Every hotel links out to live availability and pricing so you can compare your dates and book on your preferred site.`,
    },
    {
      q: `How often is this ${city} list updated?`,
      a: `The list is regenerated regularly as cosy scores and availability change, so it reflects current picks rather than a static editorial list.`,
    },
  ];
}

// Warm cosy-score badge colour (sage = very cosy → muted clay = mild).
function cosyColor(score: number): string {
  if (score >= 7.8) return '#5c6b56';
  if (score >= 6.8) return '#7c8a5f';
  if (score >= 5.6) return '#b07a4a';
  return '#a89b8c';
}

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
      const languages = Object.fromEntries([
        ...locales.map((l) => [l, `/${l}/guides/${cg.slug}`]),
        ["x-default", `/en/guides/${cg.slug}`],
      ]);
      return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url, images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }] }, twitter: { card: "summary_large_image", title, description } };
    }
    return {};
  }
  const url = `/${params.locale}/guides/${g.slug}`;
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/guides/${g.slug}`]),
    ["x-default", `/en/guides/${g.slug}`],
  ]);
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
  const { data: hRows } = await db
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
    .select('hotel_id,score,score_final,signals')
    .in('hotel_id', ids);
  const scoreMap = new Map<string, number>();
  const signalsMap = new Map<string, string[]>();
  for (const r of ((sRows || []) as Array<CS & { signals: string[] | null }>)) {
    const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
    if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
    if (r.hotel_id && Array.isArray(r.signals)) signalsMap.set(String(r.hotel_id), r.signals);
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
  // Prefer cached images from Supabase to avoid slow/fragile lookups; fall back to Places-based helper
  const idsForImgs = take.map(({ h }) => String(h.id));
  const imgMap = new Map<string, string>();
  try {
    const { data: imgRows } = await db
      .from('hotel_images')
      .select('hotel_id,url,created_at')
      .in('hotel_id', idsForImgs)
      .order('created_at', { ascending: false });
    for (const row of (imgRows || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : '';
      const url = row.url ? String(row.url) : '';
      if (!hid || !url || url.includes('placehold.co')) continue;
      if (!imgMap.has(hid)) imgMap.set(hid, url);
    }
  } catch {}

  const chosen = take.map(({ h, s }) => {
    const cached = imgMap.get(String(h.id));
    const img = cached && !cached.includes('placehold.co') ? cached : null; // real photo only — no grey boxes
    const signals = (signalsMap.get(String(h.id)) || []).slice(0, 3);
    const snippet = buildCosySnippet(params.locale, {
      city: String(h.city || cityName),
      name: String(h.name),
      cosy: s,
      rating: typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined,
      reviewsCount: undefined,
      cues: [],
      idealLevel: 'warm',
    });
    const cta = buildAffiliateUrl(bookingSearchUrl({ name: String(h.name), city: String(h.city || cityName), country: String(h.country || '') }));
    return { slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), _cosy: s, _img: img, _signals: signals, snippet, cta };
  })

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  const listJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: chosen.map((h, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}${detailsHref(h.slug)}`,
      name: h.name,
    })),
  };
  const m = i18n[params.locale as keyof typeof i18n] || i18n.en;
  const h1 = (m.guides?.h1_city || '{city} cosy hotels').replace('{city}', cityName);
  const intro = (m.guides?.intro_city || '9 handpicked cosy and romantic stays in {city}.').replace('{city}', cityName);
  const tldr = `${cityName}'s cosiest hotels are small, characterful and warm — boutique boltholes over big chains. Below are our top handpicked stays, each ranked by our 0–10 cosy score.`;
  const faqs = cityFaqs(cityName);
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{h1}</h1>
      <p className="mt-2 text-zinc-600">{intro}</p>
      <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
        <span className="font-semibold">TL;DR:</span> {tldr}
      </p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {chosen.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed px-4 py-6 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
          We’re still adding cosy hotels for {cityName}. Check back soon.
        </p>
      ) : (
        <ol className="mt-6 space-y-3">
          {chosen.map((h, idx) => (
            <li key={h.slug} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyColor(h._cosy), width: 56, height: 56, fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>
                  {h._cosy.toFixed(1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>#{idx + 1}</span>
                    <h2 className="text-lg font-semibold leading-tight">
                      <a href={detailsHref(h.slug)} className="hover:underline">{h.name}</a>
                    </h2>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>{[h.city, h.country].filter(Boolean).join(', ')}</div>
                  {h._signals.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {h._signals.map((sig) => (
                        <span key={sig} className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--line)', color: 'var(--muted)', background: 'var(--surface-2)' }}>{sig}</span>
                      ))}
                    </div>
                  )}
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--foreground)' }}>{h.snippet}</p>
                  <div className="mt-3">
                    <a href={h.cta} target="_blank" rel="noopener nofollow sponsored" className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: 'var(--ember)' }}>
                      Check availability
                    </a>
                  </div>
                </div>
                {h._img && (
                  <a href={detailsHref(h.slug)} className="flex-shrink-0 hidden sm:block">
                    <div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}>
                      <Image src={h._img} alt={`${h.name} – ${h.city}`} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(h._img)} />
                    </div>
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-4 space-y-4">
          {faqs.map((f) => (
            <div key={f.q} className="border border-zinc-200 rounded-lg bg-white p-4">
              <dt className="font-medium text-zinc-900">{f.q}</dt>
              <dd className="mt-1.5 text-sm text-zinc-700">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
export const revalidate = 600;

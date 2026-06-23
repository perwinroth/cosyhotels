import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { badLinkHotelIds } from "@/lib/linkQuality";
import ShareButton from "@/components/ShareButton";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { populatedCities } from "@/lib/social";
import { FACETS, matchesFacet } from "@/lib/facets";
import Image from "next/image";
import { messages as i18n } from "@/i18n/messages";
import { stay22AllezUrl } from "@/lib/affiliates";
import { notFound } from "next/navigation";
// import { cosyScore } from "@/lib/scoring/cosy";
import { translate } from "@/lib/i18n/translate";
import { locales } from "@/i18n/locales";
import { bboxFor } from "@/data/cityCoords";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";

type Props = { params: { slug: string; locale: string } };

// City-specific FAQ for GEO/SEO. Answers are method-based and honest — they describe how
// we score cosiness rather than asserting unverifiable local facts.
function cityFaqs(city: string, opts?: { count?: number; topName?: string; topScore?: number }): Array<{ q: string; a: string }> {
  const n = opts?.count || 0;
  const lead = opts?.topName ? ` In ${city}, that currently puts ${opts.topName} on top${opts?.topScore ? ` at ${opts.topScore.toFixed(1)}/10` : ''}.` : '';
  return [
    {
      q: `What makes a hotel in ${city} cosy?`,
      a: `Cosiness is about warmth, intimacy and character: small room counts, fireplaces or soaking tubs, natural materials like wood and stone, and reviews where guests feel genuinely welcomed rather than processed. We rank ${city} hotels on exactly these signals.${lead}`,
    },
    {
      q: `How many cosy hotels in ${city} have you scored?`,
      a: n > 0
        ? `We've AI-scored ${n} cosy ${n === 1 ? 'hotel' : 'hotels'} in ${city} that clear our cosiness bar (5+/10). Each gets a 0–10 score weighing property type and scale, amenities, the language guests use in reviews, and the setting — independent and boutique stays tend to score highest.`
        : `We're still scoring cosy hotels in ${city} — check back shortly. Each gets a 0–10 score weighing scale, amenities, guest-review language and setting.`,
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

// Strip leading postcode noise from polluted OSM city values ("211 21 Malmö" -> "Malmö").
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
      const titleBase = `${cg.city} cosy hotels – AI-scored for cosiness`;
      const descBase = `Cosy and romantic boutique hotels in ${cg.city}, each scored 0–10 for cosiness by AI.`;
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
    // Recover the real city name (with diacritics, e.g. "Malmö") from the known-city list;
    // fall back to a prettified slug only if unknown.
    const pretty = aliases[slug] || cityFromSlug(slug) || base.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    cg = { city: pretty, slug: params.slug } as unknown as ReturnType<typeof getCityGuide>;
  }
  const cityName = String((cg as { city: string }).city);

  // Source guide hotels from Supabase with robust city matching and diversity
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  type HB = { id: string; slug: string; name: string; name_en?: string | null; city: string | null; country: string | null; rating: number | null; address?: string | null; reviews_count?: number | null; source?: string | null; source_id?: string | null; lat?: number | null; lng?: number | null };
  type CS = { hotel_id: string; score: number | null; score_final: number | null };
  // Build robust variants for the city (handles common local names)
  const base = cityName.trim();
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const vset = new Set<string>([base]);
  // The slug→city fallback prettifies "aix-en-provence" to "Aix En Provence" (spaces), but
  // hotels store "Aix-en-Provence" (hyphens), so `city.ilike.%Aix En Provence%` matches nothing
  // and the page falsely shows "still scoring". Add hyphen/space variants (ilike is
  // case-insensitive) so the hyphenated stored value matches. Fixes every multi-word city not
  // in the cities data file.
  vset.add(base.replace(/\s+/g, '-'));
  vset.add(base.replace(/-/g, ' '));
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
    .select('id,slug,name,name_en,city,country,rating,address,reviews_count,source,source_id,lat,lng')
    .or(`${orCity},${orAddr}`)
    .limit(800);
  let hotels = ((hRows || []) as HB[]).filter(Boolean);
  // If the text match pool is small, widen with a lat/lng bounding box around the city center
  if (hotels.length < 100) {
    const bb = bboxFor(cityName);
    if (bb) {
      const { data: geoRows } = await db
        .from('hotels')
        .select('id,slug,name,name_en,city,country,rating,address,reviews_count,source,source_id,lat,lng')
        .gte('lat', bb.minLat)
        .lte('lat', bb.maxLat)
        .gte('lng', bb.minLng)
        .lte('lng', bb.maxLng)
        .limit(1200);
      const geoHotels = ((geoRows || []) as HB[]).filter(Boolean);
      hotels = [...hotels, ...geoHotels];
    }
  }
  const bad = await badLinkHotelIds(db);
  const ids = hotels.map((h) => String(h.id));
  const scoreMap = new Map<string, number>();
  const signalsMap = new Map<string, string[]>();
  const descMap = new Map<string, string>();
  // Chunk the .in() — a single query with hundreds of UUIDs makes a too-long URL that 400s,
  // which silently dropped ALL scores for big cities (e.g. Edinburgh → empty "still scoring").
  for (let i = 0; i < ids.length; i += 150) {
    const { data: sRows } = await db
      .from('cosy_scores')
      .select('hotel_id,score,score_final,signals,description')
      .in('hotel_id', ids.slice(i, i + 150));
    for (const r of ((sRows || []) as Array<CS & { signals: string[] | null; description: string | null }>)) {
      const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
      if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
      if (r.hotel_id && Array.isArray(r.signals)) signalsMap.set(String(r.hotel_id), r.signals);
      if (r.hotel_id && typeof r.description === 'string' && r.description.trim()) descMap.set(String(r.hotel_id), r.description.trim());
    }
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
    if (bad.has(String(h.id))) return false;
    const k = identKey(h);
    if (seenId.has(k)) return false;
    seenId.add(k);
    // TRUST: drop hotels whose named city differs from this guide's city (e.g. an Oxford
    // hotel on a 'Sunderland' street matched by address/bbox). Keep no-city-field hotels.
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
    return { h, s, exact, mention, tie, brand: brandOf(h.name) };
  });
  const sorted = scored
    .sort((a, b) => (b.exact - a.exact) || (b.mention - a.mention) || (b.s - a.s) || (b.tie - a.tie));
  // PUBLIC GATE (two-score model): the secret 0–100 Claude score lives in cosy_scores.score_100
  // (never surfaced). Anything below 50/100 (= 5.0/10) is "hidden" — kept in the DB for later
  // re-review/upgrade, but never shown. Survivors surface their public /10 score (5.0–10.0),
  // cosiest first; the homepage/top-of-list naturally features the highest. Never pad with 0.0.
  const COSY_FLOOR = 5.0; // = 50/100 public gate
  const perBrand: Record<string, number> = {};
  const seen = new Set<string>();
  const picks: typeof sorted = [];
  for (const x of sorted) {
    if (x.s < COSY_FLOOR) continue;
    if (!isLatin(String(x.h.name_en || x.h.name))) continue; // skip only if no Latin/romanized name yet
    const key = String(x.h.slug);
    if (seen.has(key)) continue;
    const bc = perBrand[x.brand] || 0;
    if (bc >= 2 && x.brand !== 'independent') continue;
    seen.add(key);
    perBrand[x.brand] = bc + 1;
    picks.push(x);
    if (picks.length >= 12) break;
  }
  const take = picks;
  // Prefer cached images from Supabase to avoid slow/fragile lookups; fall back to Places-based helper
  const idsForImgs = take.map(({ h }) => String(h.id));
  const imgMap = new Map<string, string>();
  try {
    const { data: imgRows } = await db
      .from('hotel_images')
      .select('hotel_id,url,created_at,vision_ok')
      .in('hotel_id', idsForImgs)
      .order('created_at', { ascending: false });
    for (const row of (imgRows || []) as Array<{ hotel_id: string | null; url: string | null; vision_ok: boolean | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : '';
      const url = row.url ? String(row.url) : '';
      // Skip photos the vision QA confirmed as junk (vision_ok=false) — e.g. gift vouchers,
      // logos, maps — and placeholders. Keep vetted (true) + not-yet-checked (null). Newest
      // non-junk image per hotel wins (rows are ordered created_at desc).
      if (!hid || !url || row.vision_ok === false || url.includes('placehold.co')) continue;
      if (!imgMap.has(hid)) imgMap.set(hid, url);
    }
  } catch {}

  const chosen = take.map(({ h, s }) => {
    const cached = imgMap.get(String(h.id));
    const img = cached && !cached.includes('placehold.co') ? cached : null; // real photo only — no grey boxes
    const signals = (signalsMap.get(String(h.id)) || []).slice(0, 3);
    // Real AI description only — never generic templated praise (which lied on 0.0 hotels).
    const snippet = descMap.get(String(h.id)) || '';
    // English display: non-Latin/postal cities fall back to the guide's city; "日本" → "Japan".
    const cleanedCity = displayCity(String(h.city || ''), cityName);
    const cleanedCountry = displayCountry(String(h.country || ''));
    const displayName = String(h.name_en || h.name);
    const cta = stay22AllezUrl({ name: displayName, city: cleanedCity, country: cleanedCountry, lat: h.lat ?? null, lng: h.lng ?? null, campaign: `guide-${params.locale}` });
    return { slug: String(h.slug), name: displayName, city: cleanedCity, country: cleanedCountry, _cosy: s, _img: img, _signals: signals, snippet, cta };
  })

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gotcosy.com';
  // ItemList of Hotel entities, each carrying OUR editorial cosy-score as a Review (author:
  // Got Cosy) — honest (not user-review AggregateRating, which Google restricts for self-
  // ranked items) and machine-readable so AI answer engines can cite the cosy scores.
  const listJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Cosiest hotels in ${cityName}`,
    numberOfItems: chosen.length,
    itemListElement: chosen.map((h, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Hotel',
        name: h.name,
        url: `${siteUrl}${detailsHref(h.slug)}`,
        ...(h._img && /^https?:\/\//.test(h._img) ? { image: h._img } : {}),
        ...(h.city || h.country ? { address: { '@type': 'PostalAddress', ...(h.city ? { addressLocality: h.city } : {}), ...(h.country ? { addressCountry: h.country } : {}) } } : {}),
        review: {
          '@type': 'Review',
          author: { '@type': 'Organization', name: 'Got Cosy' },
          reviewRating: { '@type': 'Rating', ratingValue: Number(h._cosy.toFixed(1)), bestRating: 10, worstRating: 0, name: 'Cosy score' },
          ...(h.snippet ? { reviewBody: h.snippet } : {}),
        },
      },
    })),
  };
  const m = i18n[params.locale as keyof typeof i18n] || i18n.en;
  const h1 = (m.guides?.h1_city || '{city} cosy hotels').replace('{city}', cityName);
  // Data-derived, unique-per-city intro (no two pages read the same): real cosy count + top pick.
  const cosyCount = sorted.filter((x) => x.s >= COSY_FLOOR).length;
  const topPick = chosen[0];
  const intro = chosen.length
    ? `We've AI-scored ${cosyCount} cosy ${cosyCount === 1 ? 'hotel' : 'hotels'} in ${cityName} for warmth, character and intimacy${topPick ? ` — led by ${topPick.name} at ${topPick._cosy.toFixed(1)}/10` : ''}. Here are the cosiest, ranked best first.`
    : `We’re still scoring cosy hotels in ${cityName}.`;
  const faqs = cityFaqs(cityName, { count: cosyCount, topName: topPick?.name, topScore: topPick?._cosy });
  // Long-tail facet links — only facets actually backed by ≥2 of this city's hotels.
  const citySlugBase = cityToSlug(cityName).replace(/-cosy-hotel$/, '');
  const availableFacets = FACETS.filter((f) => chosen.filter((h) => matchesFacet(f, h._signals, h.snippet)).length >= 2);
  // Internal linking: other cosy city guides (crawl depth + link equity + keeps users on site).
  const otherCities = (await populatedCities(db))
    .filter((c) => c.city.toLowerCase() !== cityName.toLowerCase())
    .sort((a, b) => b.hotels_scored - a.hotels_scored)
    .slice(0, 18);
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
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{h1}</h1>
        <div className="flex-none"><ShareButton title={`Cosy hotels in ${cityName}`} /></div>
      </div>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>{intro}</p>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      {chosen.length > 0 && (
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
                  {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{h.snippet}</p>}
                  <div className="mt-3">
                    <a href={h.cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: 'var(--ember)' }}>
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
            <div key={f.q} className="border rounded-lg p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <dt className="font-medium" style={{ color: 'var(--foreground)' }}>{f.q}</dt>
              <dd className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      {availableFacets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Browse {cityName} by what makes a stay cosy</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {availableFacets.map((f) => (
              <a key={f.slug} href={`/${params.locale}/cosy-hotels/${f.slug}/${citySlugBase}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}>
                Cosy hotels {f.label} in {cityName}
              </a>
            ))}
          </div>
        </section>
      )}
      {otherCities.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">More cosy city guides</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {otherCities.map((c) => (
              <a key={c.city} href={`/${params.locale}/guides/${cityToSlug(c.city)}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}>
                Cosy hotels in {c.city}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export const revalidate = 600;

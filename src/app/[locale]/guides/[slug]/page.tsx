import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { CITY_TITLE, CITY_INTRO_LEAD, CITY_EXTRA_FAQS } from "@/data/discoveryOverrides";
import { getServerSupabase } from "@/lib/supabase/server";
import ShareButton from "@/components/ShareButton";
import HotelActions from "@/components/HotelActions";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { populatedCities } from "@/lib/social";
import { FACETS, matchesFacet } from "@/lib/facets";
import { CONCEPT_BY_SLUG, cityCollectionMin, conceptCityBlocked } from "@/lib/travellerFit";
import { isMalformedSlug } from "@/lib/seo/slugGuard";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { computeGuidePicks, guideCityHasLivePick, COSY_FLOOR } from "@/lib/seo/guidePicks";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";
import Image from "next/image";
import { messages as i18n } from "@/i18n/messages";
import { stay22AllezUrl } from "@/lib/affiliates";
import { notFound } from "next/navigation";
// import { cosyScore } from "@/lib/scoring/cosy";
import { translate } from "@/lib/i18n/translate";
import { displayCity, displayCountry } from "@/lib/placeText";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";

type Props = { params: { slug: string; locale: string } };

// City-specific FAQ for GEO/SEO. Answers are method-based and honest — they describe how
// we score cosiness rather than asserting unverifiable local facts.
function cityFaqs(city: string, opts?: { count?: number; topName?: string; topScore?: number }): Array<{ q: string; a: string }> {
  const n = opts?.count || 0;
  // Only "crown" a top pick when it genuinely clears the standout bar (7.0). In cities that skew
  // modern/large (Istanbul, Bangkok, Las Vegas) the best score is barely over the floor, so
  // presenting it as "the cosiest, at 5.3/10" reads as a weak endorsement — honest framing wins.
  const lead = (opts?.topName && (opts?.topScore || 0) >= 7)
    ? ` In ${city}, that currently puts ${opts.topName} on top at ${(opts.topScore as number).toFixed(1)}/10.`
    : '';
  return [
    {
      q: `What makes a hotel in ${city} cosy?`,
      a: `Cosiness is about warmth, intimacy and character: small room counts, fireplaces or soaking tubs, natural materials like wood and stone, and reviews where guests feel genuinely welcomed rather than processed. We rank ${city} hotels on exactly these signals.${lead}`,
    },
    {
      q: `How many cosy hotels in ${city} have you scored?`,
      a: n > 0
        ? `We've AI-scored ${n} cosy ${n === 1 ? 'hotel' : 'hotels'} in ${city} that clear our cosiness bar (5+/10). Each gets a 0–10 score weighing property type and scale, amenities, the language guests use in reviews, and the setting; independent and boutique stays tend to score highest.`
        : `We're still scoring cosy hotels in ${city}; check back shortly. Each gets a 0–10 score weighing scale, amenities, guest-review language and setting.`,
    },
    {
      q: `Are cosy hotels in ${city} more expensive than chain hotels?`,
      a: `Not necessarily. Cosiness comes from character and scale, not price; many of the cosiest stays are small independents that cost less than a big-brand business hotel.`,
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (isMalformedSlug(params.slug)) return { robots: { index: false, follow: false } };
  const g = getGuide(params.slug);
  if (!g) {
    const cg = getCityGuide(params.slug);
    if (cg) {
      const titleBase = CITY_TITLE[cg.city] ?? `Cosy & Boutique Hotels in ${cg.city} – AI-Scored for Cosiness`;
      const descBase = `The cosiest boutique hotels in ${cg.city}, each AI-scored from 0 to 10 for warmth, character and intimacy, ranked best first. Cosy, romantic and independent stays, not corporate chains.`;
      const title = params.locale === 'en' ? titleBase : await translate(titleBase, params.locale);
      const description = params.locale === 'en' ? descBase : await translate(descBase, params.locale);
      // Only /en is indexed (body is English hotel data; title/excerpt are machine-translated).
      // Canonicalize every locale to the /en twin — this agrees with the canonical Google already
      // picks for these near-duplicate pages — and drop hreflang (valid only for real translations).
      const url = `/en/guides/${cg.slug}`;
      // WP4 index gate: a city guide with fewer than 3 live cosy hotels is thin — keep it reachable
      // but noindex it until it has enough (so Google only indexes substantive guides). Uses the
      // SAME count helper the sitemap uses, so sitemap-cities never lists a noindexed guide.
      const thin = (await liveCosyCountForCityName(cg.city)) < 3;
      // og:image is provided by the co-located opengraph-image.tsx (dynamic 1200×630 PNG per city).
      return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary_large_image", title, description }, ...(thin ? { robots: { index: false, follow: true } } : {}) };
    }
    // Fabricated (non-curated) guide. If it survives the ≥3-live-hotels body guard it renders 200,
    // so give it a self-referencing /en canonical and noindex it — it's an auto-generated doorway
    // page: useful to visitors, but not something we want Google to index as thin content.
    return { alternates: { canonical: `/en/guides/${params.slug}` }, robots: { index: false, follow: true } };
  }
  // Only /en is indexed; canonicalize every locale to the /en twin (no hreflang).
  const url = `/en/guides/${g.slug}`;
  const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
  const description = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary", title, description },
  };
}

export default async function GuidePage({ params }: Props) {
  if (isMalformedSlug(params.slug)) notFound();
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
  // Not a curated city guide → we synthesize one below from the DB. It renders with ≥1 live hotel
  // (stays noindex until ≥3 via the metadata thin-gate) and 404s only when the city is empty.
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

  // Source guide hotels from Supabase with robust city matching and diversity. The fetch/rank/gate
  // logic lives in the shared computeGuidePicks (src/lib/seo/guidePicks.ts), extracted so any link
  // generator can verify "does this guide exist" with the IDENTICAL predicate this page renders
  // with (2026-07-16 internal-link audit: 12 guide links pointed at cities whose raw `hotels.city`
  // value didn't survive this page's exact-match TRUST filter, e.g. postcode-suffixed or
  // differently-punctuated OSM city strings; see guidePicks.ts's module comment).
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  const { sorted, picks, scoreQueryFailed, signalsMap, descMap } = await computeGuidePicks(db, cityName);
  const take = picks;
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): fail-safe empty set by default.
  const wrongSlugs = await getStay22WrongSlugs(db);
  // Render gate: a guide with at least ONE live cosy hotel is worth showing (1–2 stay noindex via the
  // metadata thin-gate below). Only a genuinely EMPTY city 404s — into the friendly not-found.tsx —
  // which also keeps the junk-URL space finite (e.g. the old SearchAction "{search_term_string}"
  // template, or a slug for a place we don't cover). NB: a transient score-query failure also yields
  // 0 picks; never 404 that (it would drop a real city on a DB blip) — render the "temporarily
  // unavailable" state instead. Applies to curated + fabricated alike.
  if (picks.length === 0 && !scoreQueryFailed) notFound();
  // Prefer cached images from Supabase to avoid slow/fragile lookups; fall back to Places-based helper
  const idsForImgs = take.map(({ h }) => String(h.id));
  const imgMap = new Map<string, string>();
  try {
    const { data: imgRows } = await db
      .from('hotel_images')
      .select('hotel_id,url,created_at,vision_ok')
      .in('hotel_id', idsForImgs)
      .eq('vision_ok', true)
      .order('created_at', { ascending: false });
    for (const row of (imgRows || []) as Array<{ hotel_id: string | null; url: string | null; vision_ok: boolean | null }>) {
      const hid = row.hotel_id ? String(row.hotel_id) : '';
      const url = row.url ? String(row.url) : '';
      // Only vision-QA-vetted photos (vision_ok=true) show — same gate as every other surface.
      // Unchecked (null) and junk (false) never render, so a newly-scraped hotel can't flash an
      // unvetted image. Newest vetted image per hotel wins (rows are ordered created_at desc).
      if (!hid || !url || url.includes('placehold.co')) continue;
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
    return { slug: String(h.slug), name: displayName, city: cleanedCity, country: cleanedCountry, _cosy: s, _img: img, _signals: signals, snippet, cta, website: h.website ?? null };
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
  const h1 = (m.guides?.h1_city || 'Cosy & boutique hotels in {city}').replace('{city}', cityName);
  // Data-derived, unique-per-city intro (no two pages read the same): real cosy count + top pick.
  // Crucially HONEST about how cosy the top actually is — we never dress up a 5.3/10 as a "winner".
  const cosyCount = sorted.filter((x) => x.s >= COSY_FLOOR).length;
  const topPick = chosen[0];
  const topScore = topPick?._cosy ?? 0;
  const STANDOUT = 7.0; // genuinely cosy; below this we don't crown a "best"
  const WARM = 6.0;      // pleasantly cosy but not a standout
  let intro: string;
  if (!chosen.length) {
    intro = scoreQueryFailed
      ? `Cosy scores for ${cityName} are temporarily unavailable; please try again shortly.`
      : `We haven't found any cosy hotels in ${cityName} yet; we only list places we've actually scored from real guest reviews.`;
  } else if (topScore >= STANDOUT) {
    intro = `We've AI-scored ${cosyCount} cosy ${cosyCount === 1 ? 'hotel' : 'hotels'} in ${cityName} for warmth, character and intimacy, led by ${topPick.name} at ${topScore.toFixed(1)}/10. Here are the cosiest, ranked best first.`;
  } else if (topScore >= WARM) {
    intro = `We've AI-scored ${cosyCount} cosy ${cosyCount === 1 ? 'hotel' : 'hotels'} in ${cityName}. ${cityName} leans towards larger, modern hotels, so even our top picks here are pleasantly cosy rather than standouts; ${topPick.name} leads at ${topScore.toFixed(1)}/10. These are the warmest we've found, ranked best first.`;
  } else {
    intro = `${cityName} skews modern and large, and honestly none of its hotels reach our standout cosy marks yet; the best we've scored sits at ${topScore.toFixed(1)}/10. Here are its ${cosyCount} cosiest stays anyway, ranked best first, for when ${cityName} is where you need to be.`;
  }
  const introLead = CITY_INTRO_LEAD[cityName];
  if (introLead) intro = `${introLead} ${intro}`;
  const faqs = [...cityFaqs(cityName, { count: cosyCount, topName: topPick?.name, topScore: topPick?._cosy }), ...(CITY_EXTRA_FAQS[cityName] ?? [])];
  // Long-tail facet links — only facets backed by enough of this city's hotels to clear the facet
  // page's own gate (legacy 5 → 2, rising-intent facets → 5, per cityCollectionMin), so a guide
  // never links a facet/city page that 404s.
  const citySlugBase = cityToSlug(cityName).replace(/-cosy-hotel$/, '');
  // (conceptCityBlocked: a NEW rising-intent facet's control-market city page does not exist.)
  const availableFacets = FACETS.filter((f) => !conceptCityBlocked(CONCEPT_BY_SLUG[f.slug], cityName) && chosen.filter((h) => matchesFacet(f, h._signals, h.snippet)).length >= cityCollectionMin(CONCEPT_BY_SLUG[f.slug]));
  // Internal linking: other cosy city guides (crawl depth + link equity + keeps users on site).
  // `populate_state.hotels_scored` counts every hotel the pipeline scored for that city, NOT how
  // many clear the public 5.0 bar, and the city string there can carry the same OSM pollution the
  // guide page's own TRUST filter rejects (2026-07-16 link audit). Verify each candidate through
  // guideCityHasLivePick, the SAME predicate this page renders with, before linking it, so this
  // list never points at a city whose guide 404s. Pull a wider candidate pool than the 18 shown
  // since some will fail verification (mirrors the theme-hub city-link pattern in
  // src/app/[locale]/cosy-hotels/[facet]/page.tsx).
  const otherCityCandidates = (await populatedCities(db))
    .filter((c) => c.city.toLowerCase() !== cityName.toLowerCase())
    .sort((a, b) => b.hotels_scored - a.hotels_scored)
    .slice(0, 40);
  const otherCityChecks = await Promise.all(
    otherCityCandidates.map(async (c) => ((await guideCityHasLivePick(db, c.city)) ? c : null)),
  );
  const otherCities = otherCityChecks.filter((c): c is NonNullable<typeof c> => c != null).slice(0, 18);
  const saveLabels = await buildSaveLabels(params.locale);
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  // BreadcrumbList — the one schema type these pages were missing (hotel pages already emit it).
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: 'Cosy hotel guides', url: `/${params.locale}/guides` },
    { name: cityName, url: `/${params.locale}/guides/${params.slug}` },
  ]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold">{h1}</h1>
        <div className="flex-none"><ShareButton title={`Cosy hotels in ${cityName}`} /></div>
      </div>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>{intro}</p>
      {chosen.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd)} />
      {chosen.length > 0 && (
        <ol className="mt-6 space-y-3">
          {chosen.map((h, idx) => (
            <li key={h.slug} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 hidden sm:flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h._cosy), width: 56, height: 56, fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>
                  {h._cosy.toFixed(1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="sm:hidden inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-sm font-semibold text-white" style={{ background: cosyBadgeColor(h._cosy), fontFamily: 'Fraunces, serif' }}>{h._cosy.toFixed(1)}</span>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>#{idx + 1}</span>
                    <h2 className="text-lg font-semibold leading-tight">
                      <a href={detailsHref(h.slug)} className="hover:underline">{h.name}</a>
                    </h2>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--muted)' }}>{[h.city, h.country].filter(Boolean).join(', ')}</div>
                  {h.snippet && (
                    <div className="mt-2">
                      <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--ember)', letterSpacing: '0.07em' }}>Why it&apos;s cosy</span>
                      <p className="mt-0.5 text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{h.snippet}</p>
                    </div>
                  )}
                  <HotelActions stay22Href={h.cta} website={h.website} isVerifiedWrong={wrongSlugs.has(h.slug)} hotelName={h.name} city={h.city} slug={h.slug} locale={params.locale} saveLabels={saveLabels} shareTitle={`${h.name}, a cosy hotel in ${h.city}`} shareUrl={detailsHref(h.slug)} />
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

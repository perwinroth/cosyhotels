import type { Metadata } from "next";
import { Fragment } from "react";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { CITY_TITLE, CITY_INTRO_LEAD, CITY_EXTRA_FAQS } from "@/data/discoveryOverrides";
import { getServerSupabase } from "@/lib/supabase/server";
import ShareButton from "@/components/ShareButton";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { cityFromSlug, cityToSlug } from "@/lib/citySlug";
import { populatedCities } from "@/lib/social";
import { FACETS, matchesFacet } from "@/lib/facets";
import { CONCEPT_BY_SLUG, cityCollectionMin, conceptCityBlocked } from "@/lib/travellerFit";
import { isMalformedSlug } from "@/lib/seo/slugGuard";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { computeGuidePicks, guideCityHasLivePick, resolveCuratedPicks, COSY_FLOOR } from "@/lib/seo/guidePicks";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { messages as i18n } from "@/i18n/messages";
import { stay22AllezUrl } from "@/lib/affiliates";
import { notFound } from "next/navigation";
// import { cosyScore } from "@/lib/scoring/cosy";
import { translate, translateMany, translateHtml } from "@/lib/i18n/translate";
import { localeSeo } from "@/lib/i18n/seoLocale";
import { buildShareLabels } from "@/lib/i18n/shareLabels";
import { displayCity, displayCountry } from "@/lib/placeText";
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
      const titleBase = CITY_TITLE[cg.city] ?? `Cosy & Boutique Hotels in ${cg.city} | AI-Scored for Cosiness`;
      const descBase = `The cosiest boutique hotels in ${cg.city}, each AI-scored from 0 to 10 for warmth, character and intimacy, ranked best first. Cosy, romantic and independent stays, not corporate chains.`;
      const title = params.locale === 'en' ? titleBase : await translate(titleBase, params.locale);
      const description = params.locale === 'en' ? descBase : await translate(descBase, params.locale);
      // Locale-aware canonical + hreflang (founder 2026-07-23, Option B). The city-guide BODY renders
      // fully translated for TRANSLATED_LOCALES (intro, FAQ, section headings, facet/city chips and the
      // review snippets all route through translate(); see the isEn block in the render), so /sv guides
      // are genuinely Swedish and now self-canonical + carry hreflang. Untranslated locales still
      // canonical -> /en. When thin (below), the page is noindexed regardless, so canonical is moot.
      const { canonical: url, languages } = localeSeo(params.locale, `/guides/${cg.slug}`);
      // WP4 index gate: a city guide with fewer than 3 live cosy hotels is thin — keep it reachable
      // but noindex it until it has enough (so Google only indexes substantive guides). Uses the
      // SAME count helper the sitemap uses, so sitemap-cities never lists a noindexed guide.
      const thin = (await liveCosyCountForCityName(cg.city)) < 3;
      // og:image is provided by the co-located opengraph-image.tsx (dynamic 1200×630 PNG per city).
      return { title, description, alternates: { canonical: url, ...(languages ? { languages } : {}) }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary_large_image", title, description }, ...(thin ? { robots: { index: false, follow: true } } : {}) };
    }
    // Fabricated (non-curated) guide. If it survives the ≥3-live-hotels body guard it renders 200,
    // so give it a self-referencing /en canonical and noindex it — it's an auto-generated doorway
    // page: useful to visitors, but not something we want Google to index as thin content.
    return { alternates: { canonical: `/en/guides/${params.slug}` }, robots: { index: false, follow: true } };
  }
  // Locale-aware canonical + hreflang (founder 2026-07-23, Option B). Editorial guide bodies render
  // translated for TRANSLATED_LOCALES (title/excerpt via translate(), body via translateHtml() in the
  // render), so /sv editorial guides self-canonical + carry hreflang; untranslated locales -> /en.
  const { canonical: url, languages } = localeSeo(params.locale, `/guides/${g.slug}`);
  const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
  const description = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
  return {
    title,
    description,
    alternates: { canonical: url, ...(languages ? { languages } : {}) },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary", title, description },
  };
}

export default async function GuidePage({ params }: Props) {
  if (isMalformedSlug(params.slug)) notFound();
  const dbForCurated = getServerSupabase();
  const g = getGuide(params.slug);
  if (g) {
    // en short-circuits before any await so English output stays byte-identical; sv (the only
    // authorized locale, see translate.ts) translates title/excerpt as short strings and the body
    // as chunked HTML (translateHtml), all cached forever per string/chunk after the first render.
    const isEnGuide = params.locale === 'en';
    const title = isEnGuide ? g.title : await translate(g.title, params.locale);
    const excerpt = isEnGuide ? g.excerpt : await translate(g.excerpt, params.locale);
    const body = isEnGuide ? g.body : await translateHtml(g.body, params.locale);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://gotcosy.com';
    const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;

    // Hotels are resolved LIVE by slug (never a baked score) — resolveCuratedPicks reads
    // name/city/country/score/image/description/website fresh from cosy_scores/hotels at request
    // time and drops any pick that falls below the PUBLIC gate, is delisted, or is bad-link
    // flagged, silently (the #44 stale-score rule, see guidePicks.ts's module comment). `g.picks`
    // itself carries only the slug and an optional editorial `note` (a non-score fact, e.g. a
    // measured distance) — no name, no score is ever baked into guides.ts.
    const resolved = dbForCurated ? await resolveCuratedPicks(dbForCurated, g.picks) : [];
    const wrongSlugs = await getStay22WrongSlugs(dbForCurated);
    const cardPicks = resolved.map((h) => ({
      ...h,
      cta: stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `guide-${params.locale}` }),
    }));
    const saveLabels = await buildSaveLabels(params.locale);
    const shareLabels = await buildShareLabels(params.locale);

    const CH = { picksHeading: g.picksHeading, snippetEyebrow: "Why it's cosy" };
    let LC = CH;
    let snippetsT = cardPicks.map((h) => h.snippet);
    let notesT = cardPicks.map((h) => h.note || '');
    if (!isEnGuide) {
      const keys = Object.keys(CH) as (keyof typeof CH)[];
      const [chromeVals, snippetsRes, notesRes] = await Promise.all([
        Promise.all(keys.map((k) => translate(CH[k], params.locale))),
        cardPicks.length ? translateMany(snippetsT, params.locale) : Promise.resolve(snippetsT),
        cardPicks.length ? translateMany(notesT, params.locale) : Promise.resolve(notesT),
      ]);
      LC = Object.fromEntries(keys.map((k, i) => [k, chromeVals[i]])) as typeof CH;
      snippetsT = snippetsRes; notesT = notesRes;
    }

    // ItemList, same pattern as the fabricated city-guide branch and the blog picks — our
    // editorial cosy score rendered as a Review (author: Got Cosy), machine-readable for AI
    // answer engines, not a self-ranked AggregateRating.
    const listJsonLd = cardPicks.length > 0 ? {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: g.picksHeading,
      numberOfItems: cardPicks.length,
      itemListElement: cardPicks.map((h, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Hotel',
          name: h.name,
          url: `${siteUrl}${detailsHref(h.slug)}`,
          ...(h.img && /^https?:\/\//.test(h.img) ? { image: h.img } : {}),
          ...(h.city || h.country ? { address: { '@type': 'PostalAddress', ...(h.city ? { addressLocality: h.city } : {}), ...(h.country ? { addressCountry: h.country } : {}) } } : {}),
          review: {
            '@type': 'Review',
            author: { '@type': 'Organization', name: 'Got Cosy' },
            reviewRating: { '@type': 'Rating', ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: 'Cosy score' },
            ...(h.snippet ? { reviewBody: h.snippet } : {}),
          },
        },
      })),
    } : null;

    return (
      <article className="longform mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-2 text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--foreground)' }}>{title}</h1>
          <div className="flex-none"><ShareButton title={title} label={shareLabels.toggle} labels={shareLabels} /></div>
        </div>
        <p className="text-lg" style={{ color: 'var(--muted)' }}>{excerpt}</p>
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: body }} />
        {cardPicks.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">{LC.picksHeading}</h2>
            <ol className="mt-4 space-y-3">
              {cardPicks.map((h, idx) => (
                <Fragment key={h.slug}>
                  <HotelCard
                    slug={h.slug}
                    name={h.name}
                    city={h.city}
                    country={h.country}
                    score={h.score}
                    rank={idx + 1}
                    snippet={snippetsT[idx] || null}
                    snippetEyebrow={LC.snippetEyebrow}
                    photo={h.img}
                    locale={params.locale}
                    saveLabels={saveLabels}
                    stay22Href={h.cta}
                    website={h.website}
                    isVerifiedWrong={wrongSlugs.has(h.slug)}
                    shareTitle={`${h.name}, a cosy hotel in ${h.city}`}
                    shareUrl={detailsHref(h.slug)}
                  />
                  {notesT[idx] && (
                    <li className="-mt-2 list-none pl-4 text-sm sm:pl-[4.5rem]" style={{ color: 'var(--muted)' }}>{notesT[idx]}</li>
                  )}
                </Fragment>
              ))}
            </ol>
          </section>
        )}
        {listJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />}
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
  const shareLabels = await buildShareLabels(params.locale);
  // Reader-facing chrome routes through translate() for non-en locales; en short-circuits before
  // any await (founder, 2026-07-17: the /sv guide page rendered a Swedish H1 over an English
  // computed intro, English FAQ/section headings and English facet/city link labels). Assembled
  // per-city/per-facet sentences are translated as whole strings (cache is per-string; city and
  // facet counts here are bounded, ~28 cities), matching the pattern already used for the hotel
  // page's "Cosy hotels in {city}" string. Hotel names/cities/scores stay DATA, never translated.
  const isEn = params.locale === 'en';
  const CH = {
    faqHeading: 'Frequently asked questions',
    browseBy: `Browse ${cityName} by what makes a stay cosy`,
    moreGuides: 'More cosy city guides',
    snippetEyebrow: "Why it's cosy",
  };
  let LC = CH;
  let introT = intro;
  let faqsT = faqs;
  let facetLabels = availableFacets.map((f) => `Cosy hotels ${f.label} in ${cityName}`);
  let otherCityLabels = otherCities.map((c) => `Cosy hotels in ${c.city}`);
  // Hotel review-description snippets are review-grounded content, translated like the hotel and
  // facet pages' snippets (founder, 2026-07-17: the guide page was the one surface still showing
  // English snippets under a Swedish H1/intro).
  let snippetsT = chosen.map((h) => h.snippet);
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const [chromeVals, introRes, faqsRes, facetRes, otherCityRes, snippetsRes] = await Promise.all([
      Promise.all(keys.map((k) => translate(CH[k], params.locale))),
      translate(intro, params.locale),
      Promise.all(faqs.map(async (f) => ({ q: await translate(f.q, params.locale), a: await translate(f.a, params.locale) }))),
      translateMany(facetLabels, params.locale),
      translateMany(otherCityLabels, params.locale),
      snippetsT.length ? translateMany(snippetsT, params.locale) : Promise.resolve(snippetsT),
    ]);
    LC = Object.fromEntries(keys.map((k, i) => [k, chromeVals[i]])) as typeof CH;
    introT = introRes; faqsT = faqsRes; facetLabels = facetRes; otherCityLabels = otherCityRes; snippetsT = snippetsRes;
  }
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
        <div className="flex-none"><ShareButton title={`Cosy hotels in ${cityName}`} label={shareLabels.toggle} labels={shareLabels} /></div>
      </div>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>{introT}</p>
      {chosen.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd)} />
      {chosen.length > 0 && (
        <ol className="mt-6 space-y-3">
          {chosen.map((h, idx) => (
            <HotelCard
              key={h.slug}
              slug={h.slug}
              name={h.name}
              city={h.city}
              country={h.country}
              score={h._cosy}
              rank={idx + 1}
              snippet={snippetsT[idx]}
              snippetEyebrow={LC.snippetEyebrow}
              photo={h._img}
              locale={params.locale}
              saveLabels={saveLabels}
              stay22Href={h.cta}
              website={h.website}
              isVerifiedWrong={wrongSlugs.has(h.slug)}
              shareTitle={`${h.name}, a cosy hotel in ${h.city}`}
              shareUrl={detailsHref(h.slug)}
            />
          ))}
        </ol>
      )}
      <section className="mt-12">
        <h2 className="text-xl font-semibold">{LC.faqHeading}</h2>
        <dl className="mt-4 space-y-4">
          {faqsT.map((f, i) => (
            <div key={faqs[i].q} className="border rounded-lg p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <dt className="font-medium" style={{ color: 'var(--foreground)' }}>{f.q}</dt>
              <dd className="mt-1.5 text-sm" style={{ color: 'var(--muted)' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      {availableFacets.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{LC.browseBy}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {availableFacets.map((f, i) => (
              <a key={f.slug} href={`/${params.locale}/cosy-hotels/${f.slug}/${citySlugBase}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}>
                {facetLabels[i]}
              </a>
            ))}
          </div>
        </section>
      )}
      {otherCities.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{LC.moreGuides}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {otherCities.map((c, i) => (
              <a key={c.city} href={`/${params.locale}/guides/${cityToSlug(c.city)}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: 'var(--line)', color: 'var(--foreground)' }}>
                {otherCityLabels[i]}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export const revalidate = 600;

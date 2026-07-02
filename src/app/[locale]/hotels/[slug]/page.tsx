// Hotel detail — persisted, pre-scored Supabase hotels only.
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import { buildCosySnippet } from "@/i18n/snippets";
import { getServerSupabase } from "@/lib/supabase/server";
import { stay22AllezUrl } from "@/lib/affiliates";
import ShareButton from "@/components/ShareButton";
import BadgeEmbed from "@/components/BadgeEmbed";
import { cosyBadgeColor } from "@/lib/cosyColor";
import hotelFaqData from "@/data/hotelFaqs.json";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import { cityToSlug } from "@/lib/citySlug";
import { FACETS, matchesFacet } from "@/lib/facets";
import { Breadcrumb, HotelGraph, type MiniHotel, type LinkItem } from "@/components/HotelGraph";

// Rendered on-demand then cached (ISR): Supabase is hit at most once per hotel per revalidate
// window, never on every view. These are the top SEO landing pages, so cache them hard.
export const revalidate = 86400;
export const dynamicParams = true;

// Prebuild none at build time (9k+ hotels); every slug renders on first request, then caches (ISR).
export function generateStaticParams() {
  return [] as { slug: string }[];
}

// Using implicit types from Supabase rows to avoid unused warnings

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: { params: { slug: string; locale: string } }): Promise<Metadata> {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/hotels/${params.slug}`]),
    ["x-default", `/en/hotels/${params.slug}`],
  ]);
  const url = `/${params.locale}/hotels/${params.slug}`;
  const db = getServerSupabase();
  if (db) {
    const { data: h } = await db
      .from("hotels")
      .select("id, name, city, country, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    if (h) {
      const title = `${h.name} | ${site.name}`;
      // Unique, review-grounded meta description per hotel (SEO/AEO) — the same one-sentence
      // description shown on the page; falls back to location only if the hotel has none.
      let description = [h.city, h.country].filter(Boolean).join(", ") || "Cosy boutique stay.";
      const { data: s } = await db.from("cosy_scores").select("description,score,score_final").eq("hotel_id", h.id).maybeSingle();
      const cosy = (s?.score_final as number | null) ?? (s?.score as number | null) ?? null;
      // Unrated / hidden hotels (no review-grounded score above the public floor) stay reachable
      // but are noindexed until they earn a rating — no thin pages in the index.
      const rated = cosy != null && cosy >= 5;
      if (s?.description && rated) {
        description = `Cosy score ${Number(cosy).toFixed(1)}/10. ${s.description}`.slice(0, 300);
      }
      return { title, description, alternates: { canonical: url, languages }, ...(rated ? {} : { robots: { index: false, follow: true } }) };
    }
  }
  return { alternates: { canonical: url, languages } };
}

// Per-hotel FAQ — natural-language Q&A for SEO rich results + GEO/AEO (answer engines lift these).
// Every answer is GROUNDED in real data (cosy score, our description, guest rating, location) — no
// invented facts, in keeping with the trustworthy-score promise.
function hotelFaqs(o: { name: string; city: string; country: string; cosy: number | null; description: string | null; rating5: number | null; reviews: number | null; amenities?: string[] }): Array<{ q: string; a: string }> {
  const { name, city, country, cosy: s, description, rating5, reviews } = o;
  const place = [city, country].filter(Boolean).join(", ");
  const band = s == null ? "" : s >= 7.8 ? "among the cosiest stays we've scored" : s >= 6.8 ? "a genuinely cosy, characterful stay" : s >= 5.6 ? "a warm, comfortable mid-cosy stay" : "a simple, milder stay on the cosy scale";
  const amen = (o.amenities || []).map((a) => String(a).trim()).filter(Boolean);
  const aLow = amen.map((a) => a.toLowerCase());
  const hasAmen = (re: RegExp) => aLow.some((a) => re.test(a));
  const faqs: Array<{ q: string; a: string }> = [];
  faqs.push({
    q: `Is ${name} a cosy hotel?`,
    a: s != null
      ? `${name} scores ${s.toFixed(1)}/10 on Got Cosy's cosiness scale — ${band}${city ? ` in ${city}` : ""}. The score weighs warmth, intimacy and character, not stars.`
      : `Got Cosy rates hotels 0–10 for cosiness — warmth, intimacy and character${city ? `, including stays in ${city}` : ""}.`,
  });
  faqs.push({
    q: `What makes ${name} cosy?`,
    a: description && description.length > 20
      ? description
      : `We read each hotel's photos, guest reviews, scale and setting, weighting cues like warm light, natural materials and intimate scale. ${name}'s ${s != null ? `${s.toFixed(1)}/10` : "cosy score"} reflects how warm and characterful it feels.`,
  });
  if (rating5 != null) faqs.push({
    q: `How do guests rate ${name}?`,
    a: `Guests rate ${name} ${rating5.toFixed(1)}/5${reviews ? ` across ${reviews.toLocaleString()} reviews` : ""}. Got Cosy folds guest sentiment together with photos and setting into a single 0–10 cosy score${s != null ? ` (${s.toFixed(1)})` : ""}.`,
  });
  // Amenity-grounded questions (truthful — only from the hotel's listed facilities).
  if (amen.length) faqs.push({
    q: `What facilities does ${name} have?`,
    a: `${name} lists ${amen.slice(0, 8).join(", ").replace(/, ([^,]*)$/, " and $1")}${city ? `, in ${city}` : ""}.`,
  });
  const feature = hasAmen(/spa/) ? { what: "a spa", q: `Does ${name} have a spa?` }
    : hasAmen(/pool|swimming/) ? { what: "a pool", q: `Does ${name} have a pool?` }
    : hasAmen(/restaurant/) ? { what: "a restaurant", q: `Does ${name} have a restaurant?` }
    : hasAmen(/bar\b|lounge/) ? { what: "a bar", q: `Does ${name} have a bar?` }
    : hasAmen(/parking|garage/) ? { what: "parking", q: `Does ${name} offer parking?` }
    : null;
  if (feature) faqs.push({ q: feature.q, a: `Yes — ${name} lists ${feature.what} among its facilities.` });
  if (place) faqs.push({
    q: `Where is ${name} located?`,
    a: `${name} is in ${place}.${city ? ` You can browse more cosy hotels in ${city} on Got Cosy.` : ""}`,
  });
  faqs.push({
    q: `How is ${name}'s cosy score calculated?`,
    a: `Got Cosy's AI assesses a hotel's photos, guest reviews, amenities, room count and setting, scoring cosiness signals — fireplaces, warm lighting, soft textiles, intimate human scale — on one 0–10 scale. ${name} currently scores ${s != null ? s.toFixed(1) : "–"}.`,
  });
  if (s != null && s >= 7) faqs.push({
    q: `Is ${name} good for a romantic getaway?`,
    a: `With a cosy score of ${s.toFixed(1)}/10, ${name} leans warm and intimate — the kind of characterful stay that suits a couples or romantic trip${city ? ` in ${city}` : ""}.`,
  });
  return faqs;
}

export default async function HotelDetail({ params }: Props) {
  // Live OSM/Amadeus detail paths are retired — they served junk, scored per-visitor (cost),
  // and broke consistency. Only persisted, pre-scored Supabase hotels are served now.
  if (params.slug.startsWith('osm-') || params.slug.startsWith('am-')) return notFound();

  const db = getServerSupabase();
  if (!db) return notFound();

  const { data: hotel } = await db
    .from("hotels")
    .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count,lat,lng,amenities")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!hotel) {
    // Deduped/renamed hotels: 301 to the canonical slug rather than 404 (preserves SEO + links).
    const { data: redir } = await db.from("hotel_slug_redirects").select("new_slug").eq("old_slug", params.slug).maybeSingle();
    if (redir?.new_slug && redir.new_slug !== params.slug) permanentRedirect(`/${params.locale}/hotels/${redir.new_slug}`);
    return notFound();
  }

  const { data: scoreRow } = await db
    .from("cosy_scores")
    .select("score,score_final,description,signals")
    .eq("hotel_id", hotel.id)
    .maybeSingle();
  const cosy = (scoreRow?.score_final as number | null) ?? (scoreRow?.score as number | null) ?? null;
  const cosyDescription = (scoreRow?.description as string | null) ?? null;

  // ——— WP2: build the internal-linking graph (same-city hotels + safe collection links) ———
  const cityName = String(hotel.city || "").trim();
  const citySlugBase = cityName ? cityToSlug(cityName).replace(/-cosy-hotel$/, "") : "";
  let sameCity: MiniHotel[] = [];
  const collectionLinks: LinkItem[] = [];
  if (cityName) {
    const { data: peers } = await db
      .from("cosy_scores")
      .select("score,score_final,signals,description,hotel:hotel_id!inner(slug,name,name_en,city)")
      .gte("score", 5)
      .eq("hotel.city", cityName)
      .neq("hotel_id", hotel.id)
      .order("score", { ascending: false })
      .limit(40);
    type Peer = { score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null } | null };
    const rows = (peers || []) as unknown as Peer[];
    sameCity = rows.slice(0, 6).map((r) => ({ slug: String(r.hotel?.slug), name: String(r.hotel?.name_en || r.hotel?.name || ""), score: Number((r.score_final ?? r.score) || 0) })).filter((h) => h.slug && h.name);
    // Safe collection links: a facet page needs ≥2 in-city matches, so only link facets where this
    // hotel + its peers give ≥2 — guarantees the /cosy-hotels/[facet]/[city] page won't 404.
    for (const f of FACETS) {
      const self = matchesFacet(f, (scoreRow?.signals as string[] | null) ?? null, cosyDescription) ? 1 : 0;
      const peerMatches = rows.filter((r) => matchesFacet(f, r.signals, r.description)).length;
      if (self + peerMatches >= 2 && citySlugBase) collectionLinks.push({ href: `/${params.locale}/cosy-hotels/${f.slug}/${citySlugBase}`, label: `Cosy hotels ${f.label} in ${cityName}` });
    }
  }

  // Real cached photo only (no placeholder).
  let photo: string | null = null;
  try {
    const { data: imgs } = await db.from("hotel_images").select("url,created_at,vision_ok").eq("hotel_id", hotel.id).eq("vision_ok", true).order("created_at", { ascending: false });
    // Only vision-QA-vetted photos (vision_ok=true) render — same gate as the listing/city/home
    // surfaces. Unchecked (null) and junk (false) never show, so a newly-scraped hotel can't flash
    // an unvetted image (the bug that surfaced a champagne-promo thumbnail). The JUNK regex is a
    // defence-in-depth backstop; \/_?\d… catches both /320x320 and /_320x320_ thumbnail paths.
    const JUNK = /logo|favicon|wi-?fi|sprite|qr[-_]?code|\bicon\b|\bbadge\b|\/_?\d{2,3}[-x_]\d{2,3}[-_.]/i;
    for (const r of (imgs || []) as Array<{ url: string | null; vision_ok: boolean | null }>) {
      if (r.url && !r.url.includes("placehold.co") && !JUNK.test(r.url)) { photo = r.url; break; }
    }
  } catch {}

  // Use DB values to compose concise snippet
  const rating5 = typeof hotel.rating === 'number' ? Number(hotel.rating) / 2 : undefined;
  // Below the public floor (or hidden for lack of findings) = not rated: no score is shown anywhere.
  const cosyDisplay = typeof cosy === 'number' && cosy >= 5 ? cosy : undefined;
  const cosySnippet = buildCosySnippet(params.locale, {
    city: String(hotel.city || ''),
    name: String(hotel.name),
    rating: rating5,
    reviewsCount: (typeof hotel.reviews_count === 'number' ? hotel.reviews_count : undefined),
    cues: [],
    idealLevel: 'warm',
  });

  // Redirect to canonical SEO slug if any mismatch (future-safe)
  if (params.slug !== hotel.slug) {
    permanentRedirect(`/${params.locale}/hotels/${hotel.slug}`);
  }

  const badge = cosyBadgeColor(typeof cosyDisplay === 'number' ? cosyDisplay : 0);
  const bookingUrl = stay22AllezUrl({
    name: String(hotel.name), city: (hotel.city as string | null) ?? null, country: (hotel.country as string | null) ?? null,
    lat: (hotel.lat as number | null) ?? null, lng: (hotel.lng as number | null) ?? null,
    campaign: `detail-${params.locale}`,
  });
  const hotelJsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: String(hotel.name),
    description: cosyDescription ?? undefined,
    image: photo ?? undefined,
    address: { "@type": "PostalAddress", addressLocality: String(hotel.city || ""), addressCountry: String(hotel.country || "") },
    ...(rating5 != null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rating5.toFixed(1)), bestRating: 5, worstRating: 1, ...(typeof hotel.reviews_count === 'number' && hotel.reviews_count > 0 ? { ratingCount: hotel.reviews_count } : {}) } } : {}),
    url: `${site.url}/${params.locale}/hotels/${hotel.slug}`,
  };
  const breadcrumbJsonLd = breadcrumbSchema([
    { name: "Cosy hotel guides", url: `/${params.locale}/guides` },
    ...(hotel.city ? [{ name: String(hotel.city), url: `/${params.locale}/guides/${cityToSlug(String(hotel.city))}` }] : []),
    { name: String(hotel.name), url: `/${params.locale}/hotels/${hotel.slug}` },
  ]);
  const cityGuideHref = `/${params.locale}/guides/${cityToSlug(cityName || "")}`;
  const crumbItems: LinkItem[] = [
    { href: `/${params.locale}/guides`, label: "Guides" },
    ...(cityName ? [{ href: cityGuideHref, label: cityName }] : []),
    { href: `/${params.locale}/hotels/${hotel.slug}`, label: String(hotel.name) },
  ];
  const graphExtra: LinkItem[] = [
    { href: `/${params.locale}/cosy-index`, label: "The Cosy Index" },
    ...(cityName ? [{ href: cityGuideHref, label: `Cosy hotels in ${cityName}` }] : []),
  ];
  // Bespoke, review-grounded FAQ when we have one for this hotel; else the data-tailored template.
  const bespoke = (hotelFaqData as Record<string, { q: string; a: string }[]>)[String(hotel.id)];
  const faqs = bespoke?.length
    ? bespoke
    : hotelFaqs({ name: String(hotel.name), city: String(hotel.city || ''), country: String(hotel.country || ''), cosy: cosyDisplay ?? null, description: cosyDescription, rating5: rating5 ?? null, reviews: typeof hotel.reviews_count === 'number' ? hotel.reviews_count : null, amenities: Array.isArray(hotel.amenities) ? (hotel.amenities as string[]) : [] });
  const faqJsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd)} />
      <Breadcrumb items={crumbItems} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{hotel.name}</h1>
          <div className="mt-1.5 text-base" style={{ color: 'var(--muted)' }}>{[hotel.city, hotel.country].filter(Boolean).join(', ')}</div>
        </div>
        <div className="flex-none pt-1"><ShareButton title={`${hotel.name} — cosy hotel in ${hotel.city || ''}`} /></div>
      </div>

      {photo && (
        <div className="relative mt-5 w-full overflow-hidden rounded-2xl" style={{ aspectRatio: "16/9", border: "1px solid var(--line)" }}>
          <Image src={photo} alt={`${hotel.name} — ${hotel.city || ''}`} fill className="object-cover" sizes="(max-width:768px) 100vw, 768px" quality={70} unoptimized={/^https?:\/\//.test(photo)} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-5 rounded-2xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
        {cosyDisplay != null ? (
          <div className="flex-none flex flex-col items-center justify-center rounded-2xl font-display font-bold" style={{ width: 76, height: 76, background: badge, color: '#16201C', fontSize: 28 }} aria-label={`Cosy score ${cosyDisplay.toFixed(1)} out of 10`}>
            {cosyDisplay.toFixed(1)}<span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', opacity: 0.8 }}>COSY</span>
          </div>
        ) : (
          <div className="flex-none rounded-2xl border px-4 py-3 text-sm font-medium" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }} aria-label="Not yet rated">
            Not yet rated<br /><span className="text-xs font-normal">insufficient data</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          {cosyDisplay != null && (cosyDescription ?? cosySnippet)
            ? <p className="text-[15px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{cosyDescription ?? cosySnippet}</p>
            : cosyDisplay == null && <p className="text-[15px] leading-relaxed" style={{ color: 'var(--muted)' }}>We haven&apos;t gathered enough guest evidence to score this hotel for cosiness yet. It will earn a score once we have real reviews or vetted photos.</p>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <a className="rounded-xl px-4 py-2.5 no-underline text-sm" style={{ border: '1px solid var(--line)', color: 'var(--foreground)' }} href={cityName ? cityGuideHref : `/${params.locale}/guides`}>← {cityName ? `Cosy hotels in ${cityName}` : 'Browse guides'}</a>
        <a className="ml-auto rounded-xl px-5 py-3 font-medium no-underline text-sm" style={{ background: 'var(--ember)', color: '#16201C' }} href={bookingUrl} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={String(hotel.name)} data-city={String(hotel.city || '')}>Check availability</a>
      </div>

      <HotelGraph city={cityName} cityLabel={cityName} cityGuideHref={cityGuideHref} sameCity={sameCity} collections={collectionLinks} extra={graphExtra} />

      <section className="mt-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <h2 className="font-display text-2xl font-semibold">Frequently asked questions</h2>
        <dl className="mt-4 space-y-3">
          {faqs.map((f) => (
            <div key={f.q} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
              <dt className="font-medium" style={{ color: 'var(--foreground)' }}>{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {cosyDisplay != null && <BadgeEmbed slug={String(hotel.slug)} score={cosyDisplay} name={String(hotel.name)} />}
    </div>
  );
}

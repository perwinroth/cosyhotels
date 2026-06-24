// Hotel detail (Amadeus-first for am- slugs; Supabase otherwise)
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
import { cosyScore } from "@/lib/scoring/cosy";
import { claudeCosyScore } from "@/lib/scoring/claudeCosy";
import { unstable_cache } from "next/cache";

// Live OSM hotels aren't persisted, so we score them on the detail page with Claude.
// Cached per (name, city, country) for 7 days so it's at most ~one paid call per hotel
// regardless of how many times the page is viewed.
const cachedOsmScore = unstable_cache(
  async (name: string, city: string, country: string) => {
    try {
      const r = await claudeCosyScore({ name, city, country });
      return { score10: r.score10, signals: r.signals, description: r.description };
    } catch {
      return null;
    }
  },
  ["osm-claude-cosy"],
  { revalidate: 60 * 60 * 24 * 7 }
);

// Using implicit types from Supabase rows to avoid unused warnings

type Props = { params: { slug: string; locale: string }, searchParams?: { [k: string]: string | string[] | undefined } };

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
      .select("name, city, country, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    if (h) {
      const title = `${h.name} | ${site.name}`;
      const description = [h.city, h.country].filter(Boolean).join(", ") || "Cosy boutique stay.";
      return { title, description, alternates: { canonical: url, languages } };
    }
  }
  return { alternates: { canonical: url, languages } };
}

export default async function HotelDetail({ params, searchParams }: Props) {
  // Live OSM/Amadeus detail paths are retired — they served junk, scored per-visitor (cost),
  // and broke consistency. Only persisted, pre-scored Supabase hotels are served now.
  if (params.slug.startsWith('osm-') || params.slug.startsWith('am-')) return notFound();
  // Handle Amadeus slugs first so live tiles never 404
  if (params.slug.startsWith('am-')) {
    const id = params.slug.slice(3);
    try {
      const { amadeusGetHotelDetails } = await import('@/lib/vendors/amadeus');
      const { bookingSearchUrl, buildAffiliateUrl } = await import('@/lib/affiliates');
      const d = await amadeusGetHotelDetails(id);
      const qName = typeof searchParams?.name === 'string' ? searchParams!.name : '';
      const qCity = typeof searchParams?.city === 'string' ? searchParams!.city : '';
      const qCountry = typeof searchParams?.country === 'string' ? searchParams!.country : '';
      const name = (d?.name || qName || 'Hotel');
      const city = (d?.city || qCity || '');
      const country = (d?.country || qCountry || '');
      const affiliateBase = bookingSearchUrl({ name, city, country });
      const affiliateUrl = buildAffiliateUrl(affiliateBase);
      // Use the same cosy scoring as tiles to ensure consistency
      const rating10 = typeof d?.rating10 === 'number' ? d!.rating10 : undefined;
      const cosy = typeof rating10 === 'number' ? cosyScore({ rating: rating10 }) : (() => {
        const n = name.toLowerCase();
        let s = 6.6;
        const boost = ["boutique","design","charm","charming","cozy","cosy","intimate","romantic","maison","atelier","residenza","palazzo"];
        const penal = ["marriott","hilton","hyatt","accor","radisson","kempinski","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham"];
        if (boost.some(k=>n.includes(k))) s += 0.8;
        if (penal.some(k=>n.includes(k))) s -= 0.8;
        return Math.max(5.0, Math.min(9.5, s));
      })();
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{name}</h1>
          <div className="mt-1 text-zinc-600">{[city, country].filter(Boolean).join(', ')}</div>
          <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${cosy.toFixed(1)} out of 10`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-600">Cosy score</div>
                <div className="text-2xl font-semibold">{cosy.toFixed(1)}<span className="text-base text-zinc-500">/10</span></div>
              </div>
              <span />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <a className="inline-flex items-center justify-center rounded-lg bg-[#0EA5A4] text-white !text-white no-underline px-4 py-2 hover:bg-[#0B807F]" href={`/${params.locale}/hotels`}>
              Back to results
            </a>
            <div className="ml-auto flex gap-2">
              <a className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 font-medium no-underline" style={{ background: 'var(--ember)' }} href={affiliateUrl} target="_blank" rel="noopener nofollow sponsored">Check availability</a>
            </div>
          </div>
        </div>
      );
    } catch {
      return notFound();
    }
  }

  // Live OSM slugs aren't in Supabase — render from query params + Claude score.
  if (params.slug.startsWith('osm-')) {
    const { bookingSearchUrl, buildAffiliateUrl } = await import('@/lib/affiliates');
    const qName = typeof searchParams?.name === 'string' ? searchParams!.name : '';
    const qCity = typeof searchParams?.city === 'string' ? searchParams!.city : '';
    const qCountry = typeof searchParams?.country === 'string' ? searchParams!.country : '';
    const name = qName || 'Hotel';
    const city = qCity || '';
    const country = qCountry || '';
    const affiliateUrl = buildAffiliateUrl(bookingSearchUrl({ name, city, country }));
    const scored = await cachedOsmScore(name, city, country);
    const cosy = scored?.score10 ?? null;
    const description = scored?.description || null;
    const signals = scored?.signals || null;
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{name}</h1>
        <div className="mt-1 text-zinc-600">{[city, country].filter(Boolean).join(', ')}</div>
        {description && <p className="mt-3 text-sm text-zinc-700">{description}</p>}
        {signals && signals.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {signals.slice(0, 4).map((s) => (
              <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-600 bg-zinc-50">{s}</span>
            ))}
          </div>
        )}
        <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${cosy != null ? cosy.toFixed(1) : '–'} out of 10`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-600">Cosy score</div>
              <div className="text-2xl font-semibold">{cosy != null ? cosy.toFixed(1) : '–'}<span className="text-base text-zinc-500">/10</span></div>
            </div>
            <span />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <a className="inline-flex items-center justify-center rounded-lg bg-[#0EA5A4] text-white !text-white no-underline px-4 py-2 hover:bg-[#0B807F]" href={`/${params.locale}/hotels`}>
            Back to results
          </a>
          <div className="ml-auto flex gap-2">
            <a className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-3 py-2 hover:bg-zinc-50" href={affiliateUrl} target="_blank" rel="noopener nofollow sponsored">View on Booking</a>
          </div>
        </div>
      </div>
    );
  }

  const db = getServerSupabase();
  if (!db) return notFound();

  const { data: hotel } = await db
    .from("hotels")
    .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count,lat,lng")
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

  // Real cached photo only (no placeholder).
  let photo: string | null = null;
  try {
    const { data: imgs } = await db.from("hotel_images").select("url,created_at,vision_ok").eq("hotel_id", hotel.id).order("created_at", { ascending: false });
    // Skip vision-QA-rejected junk (vision_ok=false), placeholders, and obvious non-photos by
    // URL (logos, Wi-Fi/icon graphics, tiny square thumbnails) — so a hotel page never shows junk.
    const JUNK = /logo|favicon|wi-?fi|sprite|qr[-_]?code|\bicon\b|\bbadge\b|\/\d{2,3}[-x_]\d{2,3}[-_.]/i;
    for (const r of (imgs || []) as Array<{ url: string | null; vision_ok: boolean | null }>) {
      if (r.url && r.vision_ok !== false && !r.url.includes("placehold.co") && !JUNK.test(r.url)) { photo = r.url; break; }
    }
  } catch {}

  // Use DB values to compose concise snippet
  const rating5 = typeof hotel.rating === 'number' ? Number(hotel.rating) / 2 : undefined;
  const cosyDisplay = typeof cosy === 'number' ? cosy : undefined;
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

  const badge = typeof cosyDisplay === 'number'
    ? (cosyDisplay >= 9 ? '#D8B25A' : cosyDisplay >= 7.8 ? '#7FB7A2' : cosyDisplay >= 6.8 ? '#7c8a5f' : cosyDisplay >= 5.6 ? '#b07a4a' : '#a89b8c')
    : '#a89b8c';
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
    url: `${site.url}/${params.locale}/hotels/${hotel.slug}`,
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(hotelJsonLd) }} />
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
        <div className="flex-none flex flex-col items-center justify-center rounded-2xl font-display font-bold" style={{ width: 76, height: 76, background: badge, color: '#16201C', fontSize: 28 }} aria-label={`Cosy score ${cosyDisplay != null ? cosyDisplay.toFixed(1) : '–'} out of 10`}>
          {cosyDisplay != null ? cosyDisplay.toFixed(1) : '–'}<span style={{ fontFamily: 'Inter', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', opacity: 0.8 }}>COSY</span>
        </div>
        <div className="flex-1 min-w-0">
          {(cosyDescription ?? cosySnippet) && <p className="text-[15px] leading-relaxed" style={{ color: 'var(--foreground)' }}>{cosyDescription ?? cosySnippet}</p>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <a className="rounded-xl px-4 py-2.5 no-underline text-sm" style={{ border: '1px solid var(--line)', color: 'var(--foreground)' }} href={`/${params.locale}/guides`}>← Browse guides</a>
        <a className="ml-auto rounded-xl px-5 py-3 font-medium no-underline text-sm" style={{ background: 'var(--ember)', color: '#16201C' }} href={bookingUrl} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={String(hotel.name)} data-city={String(hotel.city || '')}>Check availability</a>
      </div>

      {cosyDisplay != null && <BadgeEmbed slug={String(hotel.slug)} score={cosyDisplay} name={String(hotel.name)} />}
    </div>
  );
}

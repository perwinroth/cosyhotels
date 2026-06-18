// Hotel detail (Amadeus-first for am- slugs; Supabase otherwise)
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import { buildCosySnippet } from "@/i18n/snippets";
import { getServerSupabase } from "@/lib/supabase/server";
import { bookingSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";
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
    .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!hotel) return notFound();

  const { data: scoreRow } = await db
    .from("cosy_scores")
    .select("score,score_final,description,signals")
    .eq("hotel_id", hotel.id)
    .maybeSingle();
  const cosy = (scoreRow?.score_final as number | null) ?? (scoreRow?.score as number | null) ?? null;
  const cosyDescription = (scoreRow?.description as string | null) ?? null;
  const cosySignals = (scoreRow?.signals as string[] | null) ?? null;

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{hotel.name}</h1>
      <div className="mt-1 text-zinc-600">{[hotel.city, hotel.country].filter(Boolean).join(', ')}</div>
      <p className="mt-3 text-sm text-zinc-700">{cosyDescription ?? cosySnippet}</p>

      {cosySignals && cosySignals.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {cosySignals.slice(0, 4).map((s) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-600 bg-zinc-50">{s}</span>
          ))}
        </div>
      )}

      <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${cosyDisplay != null ? cosyDisplay.toFixed(1) : '–'} out of 10`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600">Cosy score</div>
            <div className="text-2xl font-semibold">{cosyDisplay != null ? cosyDisplay.toFixed(1) : '–'}<span className="text-base text-zinc-500">/10</span></div>
          </div>
          <span />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <a className="inline-flex items-center justify-center rounded-lg bg-[#0EA5A4] text-white !text-white no-underline px-4 py-2 hover:bg-[#0B807F]" href={`/${params.locale}/hotels`}>
          Back to results
        </a>
        <div className="ml-auto flex gap-2">
          {(() => {
            // Direct OTA links so Stay22 LMA can rewrite them into affiliate links.
            const loc = { name: String(hotel.name), city: (hotel.city as string | null) ?? null, country: (hotel.country as string | null) ?? null };
            const bookingUrl = buildAffiliateUrl(bookingSearchUrl(loc));
            return (
              <a className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 font-medium no-underline" style={{ background: 'var(--ember)' }} href={bookingUrl} target="_blank" rel="noopener nofollow sponsored">Check availability</a>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// Hotel detail (Amadeus-first for am- slugs; Supabase otherwise)
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import { buildCosySnippet } from "@/i18n/snippets";
import { getServerSupabase } from "@/lib/supabase/server";
import { shimmer } from "@/lib/image";
import { getVendorImageCached } from "@/lib/imageVendor";

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

export default async function HotelDetail({ params }: Props) {
  // Handle Amadeus slugs first so live tiles never 404
  if (params.slug.startsWith('am-')) {
    const id = params.slug.slice(3);
    try {
      const { amadeusGetHotelDetails } = await import('@/lib/vendors/amadeus');
      const { bookingSearchUrl, buildAffiliateUrl } = await import('@/lib/affiliates');
      const d = await amadeusGetHotelDetails(id);
      if (!d) return notFound();
      const name = d.name || 'Hotel';
      const city = d.city || '';
      const country = d.country || '';
      const affiliateBase = bookingSearchUrl({ name, city, country });
      const affiliateUrl = buildAffiliateUrl(affiliateBase);
      const cosy = typeof d.rating10 === 'number' ? d.rating10 : 7.0;
      const imgDirect = Array.isArray(d.images) && d.images[0] ? d.images[0] : null;
      const image = imgDirect || await getVendorImageCached(params.slug, name, city, country) || '/seal.svg';
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{name}</h1>
          <div className="mt-1 text-zinc-600">{[city, country].filter(Boolean).join(', ')}</div>
          <div className="mt-3 relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
            <Image src={image} alt={`${name}`} fill priority className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, 720px" />
          </div>
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
              <a className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-3 py-2 hover:bg-zinc-50" href={affiliateUrl} target="_blank" rel="noopener nofollow sponsored">View on Booking</a>
            </div>
          </div>
        </div>
      );
    } catch {
      return notFound();
    }
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
    .select("score,score_final")
    .eq("hotel_id", hotel.id)
    .maybeSingle();
  const cosy = (scoreRow?.score_final as number | null) ?? (scoreRow?.score as number | null) ?? null;

  const { data: img } = await db
    .from('hotel_images')
    .select('url')
    .eq('hotel_id', hotel.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const image = (img?.url as string | undefined) || "/logo-seal.svg";

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
      <p className="mt-3 text-sm text-zinc-700">{cosySnippet}</p>

      <div className="mt-3 relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
        <Image src={image} alt={`${hotel.name}`} fill priority className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, 720px" />
      </div>

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
            const net = process.env.NEXT_PUBLIC_AFFILIATE_NETWORK === 'impact' ? '&network=impact' : '';
            return (
              <>
                <a className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-3 py-2 hover:bg-zinc-50" href={`/go/${hotel.slug}?provider=booking${net}`} target="_blank" rel="noopener nofollow sponsored">View on Booking</a>
                <a className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-3 py-2 hover:bg-zinc-50" href={`/go/${hotel.slug}?provider=expedia${net}`} target="_blank" rel="noopener nofollow sponsored">View on Expedia</a>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

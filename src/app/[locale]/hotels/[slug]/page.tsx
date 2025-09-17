// Supabase-first detail page with Places fallback and upsert
import { notFound, permanentRedirect } from "next/navigation";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { getDetails, photoUrl } from "@/lib/places";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import { cosyScore } from "@/lib/scoring/cosy";
import { getServerSupabase } from "@/lib/supabase/server";
import { generateHotelSlug } from "@/lib/slug";

type HotelRow = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  website: string | null;
  affiliate_url: string | null;
  rating: number | null;
  reviews_count: number | null;
  source_id: string | null;
};

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/hotels/${params.slug}`]));
  const url = `/${params.locale}/hotels/${params.slug}`;
  // Try Supabase first by slug or source_id
  const db = getServerSupabase();
  if (db) {
    const { data: h1 } = await db
      .from("hotels")
      .select("name, city, country, source_id, slug")
      .eq("slug", params.slug)
      .maybeSingle();
    const hotel = h1 || (await db.from("hotels").select("name, city, country, source_id, slug").eq("source_id", params.slug).maybeSingle()).data || null;
    if (hotel) {
      const title = `${hotel.name} | ${site.name}`;
      const description = [hotel.city, hotel.country].filter(Boolean).join(", ") || "Cosy boutique stay.";
      return { title, description, alternates: { canonical: url, languages } };
    }
  }
  // Fallback to Places for metadata
  const d = await getDetails(params.slug);
  if (d) {
    const title = `${d.name} | ${site.name}`;
    const description = d.formatted_address || "Cosy boutique stay.";
    const ref = d.photos?.[0]?.photo_reference;
    const ogImg = ref ? photoUrl(ref, 1200) : "/logo-seal.svg";
    return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url, images: [{ url: ogImg, width: 1200, height: 800 }] }, twitter: { card: "summary_large_image", title, description, images: [ogImg] } };
  }
  return { alternates: { canonical: url, languages } };
}

export default async function HotelDetail({ params }: Props) {
  const db = getServerSupabase();
  let hotel: HotelRow | null = null;
  let cosy: number | null = null;

  if (db) {
    // Try by slug first (tiles link using hotel.slug), then by source_id (Place ID)
    const { data: hBySlug } = await db
      .from("hotels")
      .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count,source_id")
      .eq("slug", params.slug)
      .maybeSingle();
    hotel = hBySlug || null;
    if (!hotel) {
      const { data: hBySrc } = await db
        .from("hotels")
        .select("id,slug,name,city,country,website,affiliate_url,rating,reviews_count,source_id")
        .eq("source_id", params.slug)
        .maybeSingle();
      hotel = hBySrc || null;
    }
    if (hotel) {
      const { data: scoreRow } = await db
        .from("cosy_scores")
        .select("score,score_final")
        .eq("hotel_id", hotel.id)
        .maybeSingle();
      cosy = (scoreRow?.score_final as number | null) ?? (scoreRow?.score as number | null) ?? null;
    }
  }

  // If not in Supabase, fetch from Places and upsert to DB
  let name = hotel?.name || "";
  let city = (hotel?.city as string | null) || "";
  let country = (hotel?.country as string | null) || "";
  let website = hotel?.website || null;
  const affiliateUrl = hotel?.affiliate_url || null;
  let image: string = "/logo-seal.svg";

  // Prefer place details for imagery; if we have a source_id use it, else try slug as place_id
  const placeId = hotel?.source_id || params.slug;
  const details = await getDetails(placeId);
  if (!hotel && details && db) {
    // Upsert minimal record so subsequent visits use Supabase
    const parts = (details.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
    const cityName = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || "");
    const countryName = parts.length ? parts[parts.length - 1] : '';
    const am: string[] = [];
    const sLower = (details.editorial_summary?.overview || details.formatted_address || '').toLowerCase();
    if (sLower.includes("spa")) am.push("Spa");
    if (sLower.includes("sauna")) am.push("Sauna");
    if (sLower.includes("fireplace")) am.push("Fireplace");
    if (sLower.includes("bath")) am.push("Bathtub");
    if (sLower.includes("rooftop")) am.push("Rooftop");
    if (sLower.includes("garden")) am.push("Garden");
    if (sLower.includes("bar")) am.push("Bar");
    if (sLower.includes("restaurant")) am.push("Restaurant");
    const slug = await generateHotelSlug(db!, details.name || params.slug, cityName, countryName);
    const { data: inserted } = await db
      .from("hotels")
      .upsert({
        source: "google-places",
        source_id: details.place_id,
        slug,
        name: details.name,
        address: details.formatted_address || null,
        city: cityName,
        country: countryName,
        lat: details.geometry?.location.lat ?? null,
        lng: details.geometry?.location.lng ?? null,
        rating: details.rating ? Number((details.rating * 2).toFixed(1)) : null,
        reviews_count: details.user_ratings_total ?? null,
        rooms_count: null,
        amenities: am.length ? am : null,
        description: details.editorial_summary?.overview || details.formatted_address || null,
        website: details.website || null,
        affiliate_url: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" })
      .select("id,slug,name,city,country,website,affiliate_url,source_id,rating,reviews_count")
      .single();
    if (inserted) {
      hotel = inserted as unknown as HotelRow;
      const base = cosyScore({ rating: details.rating ? details.rating * 2 : undefined, amenities: am, description: `${details.name}. ${details.editorial_summary?.overview || details.formatted_address || ''}`, name: details.name, website: details.website, reviewsCount: details.user_ratings_total ?? undefined, city: cityName });
      await db.from("cosy_scores").upsert({ hotel_id: inserted.id, score: base, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
      cosy = base; // until cron normalizes and sets score_final
    }
  }

  if (!hotel && !details) return notFound();

  // Redirect to canonical SEO slug if the URL uses a Place ID or old slug
  if (hotel && params.slug !== hotel.slug) {
    permanentRedirect(`/${params.locale}/hotels/${hotel.slug}`);
  }

  // If hotel exists but has no cosy score yet, compute a base score from details and persist
  if (db && hotel && cosy == null && details) {
    const parts = (details.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
    const cityName = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || "");
    const summary = details.editorial_summary?.overview || details.formatted_address || '';
    const am2: string[] = [];
    const t = summary.toLowerCase();
    if (t.includes("spa")) am2.push("Spa");
    if (t.includes("sauna")) am2.push("Sauna");
    if (t.includes("fireplace")) am2.push("Fireplace");
    if (t.includes("bath")) am2.push("Bathtub");
    if (t.includes("rooftop")) am2.push("Rooftop");
    if (t.includes("garden")) am2.push("Garden");
    if (t.includes("bar")) am2.push("Bar");
    if (t.includes("restaurant")) am2.push("Restaurant");
    const base = cosyScore({ rating: details.rating ? details.rating * 2 : undefined, amenities: am2, description: `${details.name}. ${summary}`, name: details.name, website: details.website, reviewsCount: details.user_ratings_total ?? undefined, city: cityName });
    await db.from("cosy_scores").upsert({ hotel_id: hotel.id, score: base, computed_at: new Date().toISOString() }, { onConflict: "hotel_id" });
    cosy = base;
  }

  // Resolve fields for UI
  name = name || details?.name || hotel?.name || "Hotel";
  if (!city || !country) {
    const parts = (details?.formatted_address || "").split(',').map(s => s.trim()).filter(Boolean);
    city = city || (parts.length >= 2 ? parts[parts.length - 2] : (parts[0] || ""));
    country = country || (parts.length ? parts[parts.length - 1] : "");
  }
  website = website || details?.website || null;
  const ref = details?.photos?.[0]?.photo_reference;
  image = ref ? photoUrl(ref, 1200) : image;
  const cosyDisplay = typeof cosy === 'number' ? cosy : 0;

  const goHref = (affiliateUrl || website) ? (website || affiliateUrl || undefined) : `/go/${params.slug}`;

  // Build richer cosy snippet (<= ~160 chars) using Places cues
  const rating5 = details?.rating ?? (typeof hotel?.rating === 'number' ? Number(hotel?.rating) / 2 : undefined);
  const reviewsTotal = details?.user_ratings_total ?? hotel?.reviews_count ?? undefined;
  const priceLevel = details?.price_level;
  const priceText = typeof priceLevel === 'number' ? ['budget','budget','mid-range','upscale','luxury'][Math.max(0, Math.min(4, priceLevel))] : undefined;
  const textSrc = `${details?.editorial_summary?.overview || ''} ${details?.formatted_address || ''}`.toLowerCase();
  const cues: string[] = [];
  if (textSrc.includes('fireplace')) cues.push('fireside warmth');
  if (textSrc.includes('bathtub') || textSrc.includes('soaking') || textSrc.includes('bath')) cues.push('soaking tubs');
  if (textSrc.includes('spa')) cues.push('a soothing spa');
  if (textSrc.includes('sauna')) cues.push('a calming sauna');
  if (textSrc.includes('garden')) cues.push('a quiet garden');
  if (textSrc.includes('rooftop')) cues.push('a rooftop view');
  // Pull hints from reviews text without quoting
  const reviewsText = details?.reviews as Array<{ text?: string }> | undefined;
  if (reviewsText && reviewsText.length) {
    const joined = reviewsText.map((r) => (r.text || '').toLowerCase()).join(' ');
    if (joined.includes('quiet') && !cues.includes('a quiet vibe')) cues.push('a tranquil vibe');
    if (joined.includes('romantic') && !cues.includes('a romantic feel')) cues.push('a romantic feel');
  }
  const cueList = cues.filter(Boolean).slice(0, 3);
  const cuePhrase = cueList.length ? `thanks to ${cueList.join(', ')}` : 'for its intimate scale and warm design';
  const approxReviews = (n?: number | null) => {
    if (!n || n <= 0) return '';
    if (n < 50) return `${n}`;
    const rounded = Math.floor(n / 10) * 10;
    return `${rounded}+`;
  };
  const reviewText = reviewsTotal ? ` (based on ${approxReviews(reviewsTotal)} reviews)` : '';
  const ratingPhrase = rating5 ? `We rate it ${rating5.toFixed(1)}/5${reviewText}` : '';
  const idealPhrase = priceText ? ` Ideal if you want ${priceText} comfort without losing that warm, relaxed hotel feel.` : ` Ideal if you want a warm, relaxed hotel feel.`;
  const cosyTemplates = [
    `If you're looking for a cosy hotel in ${city}, ${name} is a top pick. ${ratingPhrase} ${cuePhrase}.` + idealPhrase,
    `Searching for a cosy hotel in ${city}? ${name} stands out. ${ratingPhrase} ${cuePhrase}.` + idealPhrase,
    `${name} is among the cosiest hotels in ${city}. ${ratingPhrase} ${cuePhrase}.` + idealPhrase,
    `For a cosy stay in ${city}, ${name} is a strong choice. ${ratingPhrase} ${cuePhrase}.` + idealPhrase,
  ];
  const preferIdx = 2; // “…is among the cosiest hotels in City.”
  const tmplIndex = (name.length + (city || '').length * 7) % cosyTemplates.length;
  const cosySnippetFull = cueList.length ? cosyTemplates[preferIdx] : cosyTemplates[tmplIndex];
  const cosySnippet = cosySnippetFull.length > 180 ? `${cosySnippetFull.slice(0, 177)}...` : cosySnippetFull;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Title, address, snippet */}
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-1 text-zinc-600">{[city, country].filter(Boolean).join(', ')}</div>
      <p className="mt-3 text-sm text-zinc-700">{cosySnippet}</p>

      <div className="mt-3 relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
        <Image src={image} alt={`${name}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, 720px" />
      </div>
      {/* Hotel structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Hotel',
            name,
            url: `/${params.locale}/hotels/${hotel?.slug || params.slug}`,
            image,
            address: {
              '@type': 'PostalAddress',
              addressLocality: city || undefined,
              addressCountry: country || undefined,
            },
            aggregateRating: (() => {
              const r5 = details?.rating ?? (typeof hotel?.rating === 'number' ? Number(hotel?.rating) / 2 : undefined);
              return r5 ? { '@type': 'AggregateRating', ratingValue: Number(r5.toFixed(1)), bestRating: 5, worstRating: 1 } : undefined;
            })(),
          })
        }}
      />
      
      <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${(cosyDisplay).toFixed(1)} out of 10`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600">Cosy score</div>
            <div className="text-2xl font-semibold">{cosyDisplay.toFixed(1)}<span className="text-base text-zinc-500">/10</span></div>
          </div>
          <span />
        </div>
      </div>
      
      <div className="mt-5 flex items-center gap-3">
        <a className="inline-flex items-center justify-center rounded-lg bg-[#0EA5A4] text-white !text-white no-underline px-4 py-2 hover:bg-[#0B807F]" href={`/${params.locale}/hotels`}>
          Back to results
        </a>
        {goHref && (
          <a
            className="inline-flex items-center justify-center rounded-lg bg-white text-black border border-zinc-300 px-4 py-2 hover:bg-zinc-50"
            href={goHref}
            target="_blank"
            rel="noopener nofollow sponsored"
          >
            Visit website →
          </a>
        )}
      </div>
      {/* Per-hotel FAQ */}
      <section className="mt-6">
        <details className="rounded-lg border border-zinc-200 bg-white p-3 md:p-4">
          <summary className="cursor-pointer font-medium">Frequently asked questions</summary>
          <div className="mt-2 space-y-3">
            <div>
              <div className="font-medium">What makes {name} a cosy hotel?</div>
              <p className="text-sm text-zinc-600">{(() => {
                const cues: string[] = [];
                const sum = (details?.editorial_summary?.overview || details?.formatted_address || '').toLowerCase();
                if (sum.includes('fireplace')) cues.push('a fireplace');
                if (sum.includes('bath') || sum.includes('bathtub')) cues.push('bathtubs');
                if (sum.includes('spa')) cues.push('a spa');
                if (sum.includes('sauna')) cues.push('sauna');
                if (sum.includes('garden')) cues.push('a garden');
                const tail = cues.length ? `thanks to ${cues.slice(0,2).join(' and ')}` : 'for its small scale and warm design';
                return `${name} feels cosy ${tail}.`;
              })()}</p>
            </div>
            <div>
              <div className="font-medium">Where is {name} located?</div>
              <p className="text-sm text-zinc-600">{[city, country].filter(Boolean).join(', ')}.</p>
            </div>
            <div>
              <div className="font-medium">Is {name} suitable for a romantic getaway?</div>
              <p className="text-sm text-zinc-600">Yes — its cosy vibe and amenities make it a good pick for couples.</p>
            </div>
          </div>
        </details>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                { '@type': 'Question', name: `What makes ${name} a cosy hotel?`, acceptedAnswer: { '@type': 'Answer', text: `${name} feels cosy for its intimate scale and warm design.` } },
                { '@type': 'Question', name: `Where is ${name} located?`, acceptedAnswer: { '@type': 'Answer', text: `${[city, country].filter(Boolean).join(', ')}.` } },
                { '@type': 'Question', name: `Is ${name} suitable for a romantic getaway?`, acceptedAnswer: { '@type': 'Answer', text: `Yes — its cosy vibe and amenities make it a good pick for couples.` } },
              ],
            }),
          }}
        />
      </section>
    </div>
  );
}

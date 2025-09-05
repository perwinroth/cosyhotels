import { hotels } from "@/data/hotels";
import { notFound } from "next/navigation";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { getImageForHotel } from "@/lib/hotelImages";
import type { Metadata } from "next";
import { site } from "@/config/site";
import { fetchOverrideFor, applyOverride } from "@/lib/overrides";
import { locales } from "@/i18n/locales";
import { cosyScore, amenitiesScore, keywordSentiment, scalePenalty } from "@/lib/scoring/cosy";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const hotel = hotels.find((h) => h.slug === params.slug);
  if (!hotel) return {};
  const title = `${hotel.name} – ${hotel.city} | ${site.name}`;
  const description = hotel.description;
  const url = `/${params.locale}/hotels/${hotel.slug}`;
  const ogImg = "/hotel-placeholder.svg";
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/hotels/${hotel.slug}`]));
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      images: [{ url: ogImg, width: 1200, height: 800, alt: `${hotel.name} in ${hotel.city}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImg],
    },
  };
}

export default async function HotelDetail({ params }: Props) {
  const base = hotels.find((h) => h.slug === params.slug);
  if (!base) return notFound();
  const override = await fetchOverrideFor(params.slug);
  const hotel = applyOverride(base, override);
  const cosy = cosyScore({ rating: hotel.rating, amenities: hotel.amenities, description: hotel.description });
  const parts = {
    rating: Math.min(5, (hotel.rating ?? 8) / 10 * 5),
    amen: amenitiesScore(hotel.amenities),
    desc: keywordSentiment(hotel.description) * 2,
    scale: scalePenalty(undefined),
  };
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-zinc-200">
        <Image src={(await getImageForHotel(hotel.name, hotel.city, 1200)) || "/hotel-placeholder.svg"} alt={`${hotel.name} – ${hotel.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, 720px" />
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{hotel.name}</h1>
      <div className="mt-1 text-zinc-600">
        {hotel.city}, {hotel.country}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-emerald-100 text-emerald-700 px-2 py-0.5" title="Guest rating">{hotel.rating.toFixed(1)}</span>
        <span className="text-zinc-500">·</span>
        <span>From ${hotel.price}/night</span>
      </div>
      <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white" aria-label={`Cosy score ${cosy.toFixed(1)} out of 10`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-zinc-600">Cosy score</div>
            <div className="text-2xl font-semibold">{cosy.toFixed(1)}<span className="text-base text-zinc-500">/10</span></div>
          </div>
          <a href={`/${params.locale}/cosy-score`} className="text-sm text-zinc-600 hover:underline">How it’s calculated</a>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="flex justify-between"><span>Overall rating</span><span>{parts.rating.toFixed(1)}/5</span></div>
            <div className="h-1.5 bg-zinc-100 rounded"><div className="h-1.5 bg-emerald-500 rounded" style={{ width: `${(parts.rating/5)*100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between"><span>Amenities warmth</span><span>{parts.amen.toFixed(1)}/3</span></div>
            <div className="h-1.5 bg-zinc-100 rounded"><div className="h-1.5 bg-green-500 rounded" style={{ width: `${(parts.amen/3)*100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between"><span>Description keywords</span><span>{(parts.desc).toFixed(1)}/2</span></div>
            <div className="h-1.5 bg-zinc-100 rounded"><div className="h-1.5 bg-amber-500 rounded" style={{ width: `${(parts.desc/2)*100}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between"><span>Scale penalty</span><span>{parts.scale.toFixed(1)}</span></div>
            <div className="h-1.5 bg-zinc-100 rounded"><div className="h-1.5 bg-zinc-400 rounded" style={{ width: `${Math.max(0, (parts.scale + 1)/2)*100}%` }} /></div>
          </div>
        </div>
      </div>
      <div className="mt-5">
        <a
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 text-white px-4 py-2 hover:bg-zinc-800"
          href={`/go/${hotel.slug}`}
          target="_blank"
          rel="noopener nofollow sponsored"
        >
          Check availability →
        </a>
      </div>
      <p className="mt-4 text-zinc-700 leading-relaxed">{hotel.description}</p>
      <div className="mt-6">
        <h2 className="font-medium">Amenities</h2>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {hotel.amenities.map((a) => (
            <span key={a} className="rounded-full bg-zinc-100 border border-zinc-200 px-3 py-1">
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* JSON-LD for Hotel schema and breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Hotel',
            name: hotel.name,
            url: `/hotels/${hotel.slug}`,
            address: { '@type': 'PostalAddress', addressLocality: hotel.city, addressCountry: hotel.country },
            aggregateRating: { '@type': 'AggregateRating', ratingValue: hotel.rating, reviewCount: 120 },
            priceRange: `$${hotel.price}+`,
            amenityFeature: hotel.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
            image: ['/hotel-placeholder.svg'],
            additionalProperty: [{ '@type': 'PropertyValue', name: 'CosyScore', value: cosy.toFixed(1), unitText: 'out of 10' }],
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: '/' },
              { '@type': 'ListItem', position: 2, name: 'Hotels', item: '/hotels' },
              { '@type': 'ListItem', position: 3, name: hotel.name, item: `/hotels/${hotel.slug}` },
            ],
          }),
        }}
      />
    </div>
  );
}

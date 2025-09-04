import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { filterHotels, hotels as baseHotels } from "@/data/hotels";
import Filters from "@/components/Filters";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { cosyScore } from "@/lib/scoring/cosy";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/hotels`]));
  return {
    alternates: {
      canonical: `/${params.locale}/hotels`,
      languages,
    },
    title: "Explore hotels",
    description: "Browse unique stays with filters and sorting.",
  };
}

export default function HotelsPage({
  searchParams,
  params,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  params: { locale: string };
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Explore hotels</h1>
      <div className="mt-6 grid md:grid-cols-[16rem_1fr] gap-6">
        <Filters />
        <Results searchParams={searchParams} locale={params.locale} />
      </div>
    </div>
  );
}

async function Results({
  searchParams,
  locale,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  locale: string;
}) {
  const params = searchParams;
  const overrides = await fetchOverrides();
  const hotels = applyOverrides(baseHotels, overrides);
  const city = typeof params.city === "string" ? params.city : undefined;
  const minRating = typeof params.minRating === "string" ? Number(params.minRating) : undefined;
  const amenities = Array.isArray(params.amenity)
    ? (params.amenity as string[])
    : typeof params.amenity === "string"
    ? [params.amenity]
    : undefined;
  const sort = (params.sort as any) || "cosy-desc";

  const results = filterHotels.call({ hotels }, { city, minRating, amenities, sort } as any) || filterHotels({ city, minRating, amenities, sort });
  // If filterHotels references module hotels, compute from our merged list
  const mergedResults = hotels
    .filter((h) => (city ? h.city.toLowerCase().includes(city.toLowerCase()) : true))
    .filter((h) => (minRating ? h.rating >= minRating : true))
    .filter((h) => (amenities && amenities.length ? amenities.every((a) => h.amenities.includes(a)) : true));
  const withCosy = mergedResults.map((h) => ({
    ...h,
    _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
  }));

  function cosyBadgeClass(score: number) {
    if (score >= 8.5) return "bg-emerald-100 text-emerald-800";
    if (score >= 7.0) return "bg-green-100 text-green-800";
    if (score >= 5.0) return "bg-amber-100 text-amber-800";
    return "bg-zinc-100 text-zinc-700";
  }

  switch (sort) {
    case "rating-desc":
      withCosy.sort((a, b) => b.rating - a.rating);
      break;
    case "price-asc":
      withCosy.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      withCosy.sort((a, b) => b.price - a.price);
      break;
    case "cosy-asc":
      withCosy.sort((a, b) => a._cosy - b._cosy);
      break;
    case "cosy-desc":
    default:
      withCosy.sort((a, b) => b._cosy - a._cosy);
      break;
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="col-span-full text-sm text-zinc-600">
        {withCosy.length} result{withCosy.length === 1 ? "" : "s"}
        {city ? ` in ${city}` : ""}
      </div>
      {withCosy.length === 0 && (
        <div className="col-span-full text-zinc-600">No hotels found. Try broadening your filters.</div>
      )}
      {withCosy.map((h) => (
        <Link
          key={h.slug}
          href={`/${locale}/hotels/${h.slug}`}
          className="block overflow-hidden rounded-xl border border-zinc-200 hover:shadow-sm"
          aria-label={`${h.name}, cosy score ${h._cosy.toFixed(1)} out of 10`}
          data-cosy={h._cosy.toFixed(1)}
        >
          <div className="relative aspect-[4/3] bg-zinc-100">
            <Image src="/hotel-placeholder.svg" alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium line-clamp-1">{h.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`} title="Cosy score">
                  Cosy {h._cosy.toFixed(1)}
                </span>
                <span className="text-xs rounded bg-zinc-100 text-zinc-700 px-2 py-0.5" title="Guest rating">
                  {h.rating.toFixed(1)}
                </span>
              </div>
            </div>
            <div className="text-sm text-zinc-600">{h.city}</div>
            <div className="mt-2 text-sm text-zinc-700">From ${h.price}/night</div>
            <div className="mt-2 h-1.5 rounded bg-zinc-100">
              <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${Math.min(100, (h._cosy/10)*100)}%` }} aria-hidden />
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">
              <a className="hover:underline" href={`/${locale}/cosy-score`} onClick={(e) => e.stopPropagation()}>What is Cosy?</a>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

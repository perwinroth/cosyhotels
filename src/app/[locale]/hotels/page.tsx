import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels as baseHotels } from "@/data/hotels";
import FiltersBar from "@/components/FiltersBar";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { cosyScore } from "@/lib/scoring/cosy";
import { getImageForHotel } from "@/lib/hotelImages";
import HotelTile from "@/components/HotelTile";
import { searchText, photoUrl } from "@/lib/places";

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
      <div className="mt-4 sticky top-16 z-20">
        <FiltersBar />
      </div>
      <div className="mt-6">
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
  const city = typeof params.city === "string" && params.city.trim() ? params.city.trim() : undefined;
  const rank = typeof params.rank === "string" ? params.rank : ""; // high|mid|low (by cosy)
  const amenities = Array.isArray(params.amenity)
    ? (params.amenity as string[])
    : typeof params.amenity === "string"
    ? [params.amenity]
    : undefined;
  type Sort = "cosy-desc" | "cosy-asc" | "rating-desc" | "price-asc" | "price-desc" | "relevance";
  const allowedSort: ReadonlyArray<Sort> = ["cosy-desc","cosy-asc","rating-desc","price-asc","price-desc","relevance"];
  const isSort = (v: unknown): v is Sort => typeof v === "string" && allowedSort.includes(v as Sort);
  const sortCandidate = typeof params.sort === "string" ? params.sort : undefined;
  const sort: Sort = isSort(sortCandidate) ? sortCandidate : "cosy-desc";

  // Compute results from merged list
  const mergedResults = hotels
    .filter((h) => (city ? h.city.toLowerCase().includes(city.toLowerCase()) : true))
    .filter((h) => (amenities && amenities.length ? amenities.every((a) => h.amenities.includes(a)) : true));
  const curated = await Promise.all(mergedResults.map(async (h) => ({
    ...h,
    _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
    _img: h.image || (await getImageForHotel(h.name, h.city, 800, h.slug, h.id)) || "/hotel-placeholder.svg",
  })));

  // Google Places augmentation for broader coverage when searching by city
  let places: typeof curated = [];
  if (city) {
    const data = await searchText(`cosy boutique hotel in ${city}`);
    places = (data.results || []).slice(0, 24).map((r) => ({
      id: r.place_id,
      slug: r.place_id,
      name: r.name,
      city,
      country: "",
      rating: r.rating || 0,
      price: NaN,
      amenities: [],
      description: r.formatted_address || "",
      affiliateUrl: "",
      _cosy: (() => {
        const base10 = (r.rating || 4) * 2; // approx 0..10 from 0..5
        const desc = `${r.name}. ${r.formatted_address || ""}`;
        return Math.min(10, Math.max(0, base10 * 0.7 + (desc.toLowerCase().includes('cozy') || desc.toLowerCase().includes('cosy') ? 1.0 : 0)));
      })(),
      _img: r.photos?.[0]?.photo_reference ? photoUrl(r.photos[0].photo_reference, 800) : "/hotel-placeholder.svg",
    }));
  }

  // Optional rank filter based on cosy
  const withCosy = [...curated, ...places];
  const filtered = withCosy.filter((h) => {
    if (rank === "high") return h._cosy >= 7.5;
    if (rank === "mid") return h._cosy >= 6.5 && h._cosy < 7.5;
    if (rank === "low") return h._cosy < 6.5;
    return true;
  });

  // badge colors provided by cosyBadgeClass

  switch (sort) {
    case "rating-desc":
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    case "price-asc":
      filtered.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      filtered.sort((a, b) => b.price - a.price);
      break;
    case "cosy-asc":
      filtered.sort((a, b) => a._cosy - b._cosy);
      break;
    case "cosy-desc":
    default:
      filtered.sort((a, b) => b._cosy - a._cosy);
      break;
  }

  const renderCard = (h: typeof filtered[number]) => (
    <HotelTile key={`${h.slug}-${h._img}`} hotel={{ slug: String(h.slug), name: h.name, city: h.city, rating: h.rating, price: isFinite(h.price as number) ? (h.price as number) : undefined, image: h._img, cosy: h._cosy }} href={`/${locale}/hotels/${h.slug}`} />
  );

  const groups = sort === "cosy-desc"
    ? {
        high: filtered.filter((h) => h._cosy >= 7.5),
        mid: filtered.filter((h) => h._cosy >= 6.5 && h._cosy < 7.5),
        low: filtered.filter((h) => h._cosy < 6.5),
      }
    : null;

  return (
    <div className="grid md:grid-cols-3 gap-4 auto-rows-fr">
      <div className="col-span-full text-sm text-black" aria-live="polite">
        {filtered.length} result{filtered.length === 1 ? "" : "s"}
        {city ? ` in ${city}` : ""}
      </div>
      {filtered.length === 0 && (
        <div className="col-span-full text-zinc-600">No hotels found. Try broadening your filters.</div>
      )}

      {groups ? (
        <>
          {groups.high.length > 0 && (
            <>
              <div className="col-span-full sticky top-16 z-10 bg-white/90 backdrop-blur px-1 py-1 text-sm font-medium">High cosy</div>
              {groups.high.map(renderCard)}
            </>
          )}
          {groups.mid.length > 0 && (
            <>
              <div className="col-span-full sticky top-16 z-10 bg-white/90 backdrop-blur px-1 py-1 text-sm font-medium">Mid cosy</div>
              {groups.mid.map(renderCard)}
            </>
          )}
          {groups.low.length > 0 && (
            <>
              <div className="col-span-full sticky top-16 z-10 bg-white/90 backdrop-blur px-1 py-1 text-sm font-medium">Low cosy</div>
              {groups.low.map(renderCard)}
            </>
          )}
        </>
      ) : (
        filtered.map(renderCard)
      )}
    </div>
  );
}

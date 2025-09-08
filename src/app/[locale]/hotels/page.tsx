// unified listings page
import { hotels as baseHotels } from "@/data/hotels";
import FiltersBar from "@/components/FiltersBar";
import { SearchBar } from "@/components/HomeSections";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { cosyScore } from "@/lib/scoring/cosy";
import { getImageForHotel } from "@/lib/hotelImages";
import HotelTile from "@/components/HotelTile";
import { searchText, photoUrl } from "@/lib/places";
import type { PlaceSearchResult } from "@/lib/places";

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
      <div className="mt-2">
        <FiltersBar prepend={<SearchBar locale={params.locale} />} />
      </div>
      <div className="mt-2">
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

  // Google Places augmentation
  let places: typeof curated = [];
  const makePlace = (r: PlaceSearchResult, cityName?: string) => ({
    id: r.place_id,
    slug: r.place_id,
    name: r.name,
    city: cityName || (r.formatted_address || "").split(",")[0] || "",
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
  });
  if (city) {
    const data = await searchText(`cosy boutique hotel in ${city}`);
    places = (data.results || []).slice(0, 24).map((r) => makePlace(r, city));
  } else {
    // First page: show the 9 highest cosy ranked worldwide (augment curated with a generic Places query)
    const data = await searchText("cosy boutique hotel");
    places = (data.results || []).slice(0, 24).map((r) => makePlace(r));
  }

  // Merge curated + places, de-duplicate by name+city, then optionally filter by rank
  const merged = [...curated, ...places];
  const seen = new Set<string>();
  const withCosy = merged.filter((h) => {
    const key = `${h.name.toLowerCase()}|${(h.city || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  // For the very first page (no city), always cap to top 9 by cosy
  if (!city) filtered.sort((a, b) => b._cosy - a._cosy);
  const limited = !city ? filtered.slice(0, 9) : filtered;

  // Flat list; if empty (with city), show fallback top cosy curated
  if (limited.length === 0) {
    const fallback = [...curated].sort((a, b) => b._cosy - a._cosy).slice(0, 24);
    return (
      <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
        <div className="col-span-full sr-only" aria-live="polite">
          0 results{city ? ` in ${city}` : ""}. Showing top cosy stays worldwide.
        </div>
        {fallback.map(renderCard)}
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
      <div className="col-span-full sr-only" aria-live="polite">
        {limited.length} result{limited.length === 1 ? "" : "s"}
        {city ? ` in ${city}` : ""}
      </div>
      {limited.map(renderCard)}
    </div>
  );
}

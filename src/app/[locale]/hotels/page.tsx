import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels as baseHotels } from "@/data/hotels";
import FiltersBar from "@/components/FiltersBar";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { cosyScore, cosyBadgeClass, cosyRankLabel } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";

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
  const city = typeof params.city === "string" ? params.city : undefined;
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
  const withCosy = mergedResults.map((h) => ({
    ...h,
    _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
  }));

  // Optional rank filter based on cosy
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
    <Link
      key={h.slug}
      href={`/${locale}/hotels/${h.slug}`}
      className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full"
      aria-label={`${h.name}, cosy score ${h._cosy.toFixed(1)} out of 10`}
      data-cosy={h._cosy.toFixed(1)}
    >
      <div className="relative aspect-[4/3] bg-zinc-100">
        <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px" />
        {h._cosy >= 6.5 ? (
          <div className="absolute -left-3 top-4 rotate-[-15deg]">
            <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
              <Image src="/seal.svg" alt="seal" width={14} height={14} />
              <span>Seal of approval</span>
            </div>
          </div>
        ) : null}
        <div className="absolute left-2 top-2 flex gap-2">
          <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>
            Cosy {h._cosy.toFixed(1)} · {cosyRankLabel(h._cosy)}
          </span>
        </div>
        <div className="absolute right-2 top-2 text-xs rounded bg-black/70 text-white px-2 py-0.5">★ {h.rating.toFixed(1)}</div>
      </div>
      <div className="p-3 flex flex-col h-[188px]">
        <div>
          <h3 className="font-medium line-clamp-1">{h.name}</h3>
          <div className="text-sm text-black">{h.city}</div>
          <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>
        </div>
        <div className="mt-auto pt-4 flex justify-end">
          <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
        </div>
      </div>
    </Link>
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

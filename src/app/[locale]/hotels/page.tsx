// unified listings page
import { hotels as baseHotels } from "@/data/hotels";
import { SearchBar } from "@/components/HomeSections";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { cosyScore, adhocCosyScore } from "@/lib/scoring/cosy";
import { getImageForHotel } from "@/lib/hotelImages";
import HotelTile from "@/components/HotelTile";
import { searchText, photoUrl, getDetails } from "@/lib/places";
import type { PlaceSearchResult } from "@/lib/places";
import { getServerSupabase } from "@/lib/supabase/server";

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
      <SearchBar locale={params.locale} />
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
  type Sort = "cosy-desc" | "cosy-asc";
  const allowedSort: ReadonlyArray<Sort> = ["cosy-desc","cosy-asc"];
  const isSort = (v: unknown): v is Sort => typeof v === "string" && allowedSort.includes(v as Sort);
  const sortCandidate = typeof params.sort === "string" ? params.sort : undefined;
  const sort: Sort = isSort(sortCandidate) ? sortCandidate : "cosy-desc";

  // Front page: prefer persisted global top 9 from Supabase if available
  if (!city) {
    const supabase = getServerSupabase();
    if (supabase) {
      type DBHotel = {
        id: string;
        slug: string;
        name: string;
        city: string;
        country: string | null;
        rating: number | null;
        price: number | null;
        affiliate_url: string | null;
      };
      type DBRow = { score: number; hotel: DBHotel | DBHotel[] | null };
      const { data, error } = await supabase
        .from("cosy_scores")
        .select("score, hotel:hotel_id (id,slug,name,city,country,rating,price,affiliate_url)")
        .gte("score", 7)
        .order("score", { ascending: false })
        .limit(9);
      if (!error && data && data.length) {
        // Ensure we return exactly 9: fill from next-best if <9 meet ≥7
        let rows = (data as unknown as DBRow[]);
        if (rows.length < 9) {
          const { data: fill } = await supabase
            .from("cosy_scores")
            .select("score, hotel:hotel_id (id,slug,name,city,country,rating,price,affiliate_url)")
            .lt("score", 7)
            .order("score", { ascending: false })
            .limit(9 - rows.length);
          if (fill) rows = rows.concat(fill as unknown as DBRow[]);
        }

        const top = (await Promise.all(
          rows
            .map(async (r) => {
              const h = (Array.isArray(r.hotel) ? r.hotel[0] : r.hotel) as DBHotel | null;
              if (!h) return null;
              return {
                slug: String(h.slug),
                name: String(h.name),
                city: String(h.city || ''),
                country: (h.country as string | null) || "",
                rating: typeof h.rating === 'number' ? h.rating : 0,
                price: typeof h.price === 'number' ? h.price : NaN,
                _cosy: Number(r.score) || 0,
                _img: (await getImageForHotel(h.name as string, h.city as string, 800, h.slug as string, h.id as string)) || "/logo-seal.svg",
                affiliateUrl: (h.affiliate_url as string | null) || "",
              };
            })
        ))
        .filter(Boolean) as Array<{
          slug: string; name: string; city: string; country: string; rating: number; price: number; _cosy: number; _img: string; affiliateUrl: string;
        }>;
        const detailsHref = (slug: string) => `/${locale}/hotels/${slug}`;
        const renderTop = (h: typeof top[number]) => (
          <HotelTile
            key={`${h.slug}-${h._img}`}
            hotel={{
              slug: String(h.slug),
              name: h.name,
              city: h.city,
              country: h.country,
              rating: h.rating,
              price: isFinite(h.price as number) ? (h.price as number) : undefined,
              image: h._img,
              cosy: h._cosy,
            }}
            href={detailsHref(h.slug)}
            goHref={h.affiliateUrl ? `/go/${h.slug}` : undefined}
          />
        );
        if (top.length >= 9) {
          return (
            <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
              <div className="col-span-full sr-only" aria-live="polite">
                Top 9 cosy places worldwide (weekly)
              </div>
              {top.map(renderTop)}
            </div>
          );
        }
        // If fewer than 9 found in Supabase, fall back to dynamic build below
      }
    }
  }

  // Compute results from merged list
  const mergedResults = hotels
    .filter((h) => (city ? h.city.toLowerCase().includes(city.toLowerCase()) : true))
    .filter((h) => (amenities && amenities.length ? amenities.every((a) => h.amenities.includes(a)) : true));
  const curated = await Promise.all(mergedResults.map(async (h) => ({
    ...h,
    _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
    _img: h.image || (await getImageForHotel(h.name, h.city, 800, h.slug, h.id)) || "/seal.svg",
  })));

  // Google Places augmentation
  let places: typeof curated = [];
  const makePlace = (r: PlaceSearchResult, cityName?: string) => ({
    id: r.place_id,
    slug: r.place_id,
    name: r.name,
    city: cityName || (r.formatted_address || "").split(",")[0]?.trim() || "",
    country: (() => {
      const parts = (r.formatted_address || "").split(",").map(s => s.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : "";
    })(),
    rating: r.rating || 0,
    price: NaN,
    amenities: [],
    description: r.formatted_address || "",
    affiliateUrl: "",
    _cosy: adhocCosyScore({ rating: r.rating, summary: r.formatted_address, name: r.name }),
    _img: r.photos?.[0]?.photo_reference ? photoUrl(r.photos[0].photo_reference, 800) : "/seal.svg",
  });
  if (city) {
    const data = await searchText(`cosy boutique hotel in ${city}`);
    let tmp = (data.results || []).slice(0, 48).map((r) => makePlace(r, city));
    // Enrich missing images for city search as well
    tmp = await Promise.all(
      tmp.map(async (p) => {
        if (p._img === "/seal.svg") {
          try {
            const d = await getDetails(String(p.slug));
            const ref = d?.photos?.[0]?.photo_reference;
            if (ref) return { ...p, _img: photoUrl(ref, 800) } as typeof tmp[number];
          } catch {}
        }
        return p;
      })
    );
    places = tmp;
  } else {
    // Front page: broaden queries to avoid regional bias and fetch a diverse global pool
    const queries = [
      // English and localized synonyms
      "cosy boutique hotel",
      "cozy boutique hotel",
      "charming boutique hotel",
      "romantic boutique hotel",
      "hôtel de charme",
      "hotel con encanto",
      "gemütliches hotel",
      "koseligt hotel",
      "mysigt hotell",
      "hyggelig hotel",
      // Regional and country qualifiers
      "cosy boutique hotel in Europe",
      "cosy boutique hotel in Asia",
      "cosy boutique hotel in Japan",
      "cosy boutique hotel in Italy",
      "cosy boutique hotel in France",
      "cosy boutique hotel in Greece",
      "cosy boutique hotel in Spain",
      "cosy boutique hotel in Portugal",
      "cosy boutique hotel in Thailand",
      "cosy boutique hotel in Indonesia",
      "cosy boutique hotel in Mexico",
      "cosy boutique hotel in Morocco",
    ];
    // Fetch first page for all queries
    const batches = await Promise.all(queries.map((q) => searchText(q)));
    let results = batches.flatMap((b) => (b.results || []));
    // If still light on candidates, try a second page for the first few queries
    if (results.length < 60) {
      const nexts = await Promise.all(
        batches
          .slice(0, 5)
          .map((b) => (b.next_page_token ? searchText("", b.next_page_token) : Promise.resolve({ results: [] } as { results: PlaceSearchResult[] })))
      );
      results = results.concat(nexts.flatMap((n) => n.results || []));
    }
    const seenPlace = new Set<string>();
    const picked: PlaceSearchResult[] = [];
    for (const r of results) {
      if (!r.place_id || seenPlace.has(r.place_id)) continue;
      seenPlace.add(r.place_id);
      picked.push(r);
      if (picked.length >= 150) break; // safety cap
    }
    let tmp = picked.map((r) => makePlace(r));
    // Enrich missing images by fetching details for those without photos
    tmp = await Promise.all(
      tmp.map(async (p) => {
        if (p._img === "/seal.svg") {
          try {
            const d = await getDetails(String(p.slug));
            const ref = d?.photos?.[0]?.photo_reference;
            if (ref) return { ...p, _img: photoUrl(ref, 800) } as typeof tmp[number];
          } catch {}
        }
        return p;
      })
    );
    places = tmp;
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
    case "cosy-asc":
      filtered.sort((a, b) => a._cosy - b._cosy);
      break;
    case "cosy-desc":
    default:
      filtered.sort((a, b) => b._cosy - a._cosy);
      break;
  }

  const renderCard = (h: typeof filtered[number]) => {
    const detailsHref = `/${locale}/hotels/${h.slug}`;
    const hasAffiliate = ("affiliateUrl" in h && (h as { affiliateUrl?: string }).affiliateUrl);
    const isPlace = !(typeof h.price === "number" && isFinite(h.price as number));
    const goHref = (hasAffiliate || isPlace) ? `/go/${h.slug}` : undefined;
    return (
      <HotelTile
        key={`${h.slug}-${h._img}`}
        hotel={{
          slug: String(h.slug),
          name: h.name,
          city: h.city,
          country: ("country" in h ? (h as { country?: string }).country : undefined) || undefined,
          rating: h.rating,
          price: isFinite(h.price as number) ? (h.price as number) : undefined,
          image: h._img,
          cosy: h._cosy,
        }}
        href={detailsHref}
        goHref={goHref}
      />
    );
  };

  // Front page: show the top 9 worldwide with Seal of approval (cosy >= 7)
  if (!city) filtered.sort((a, b) => b._cosy - a._cosy);
  const limited = !city ? filtered.filter((h) => h._cosy >= 7.0).slice(0, 9) : filtered;

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

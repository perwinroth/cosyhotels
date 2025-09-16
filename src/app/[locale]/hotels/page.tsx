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
      type FT = { position: number; score: number; image_url: string | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; affiliate_url: string | null } | null };
      const { data, error } = await supabase
        .from("featured_top")
        .select("position, score, image_url, hotel:hotel_id (id,slug,name,city,country,rating,price,affiliate_url)")
        .order("position", { ascending: true })
        .limit(9);
      if (!error && data) {
        const rows = (data as unknown as FT[]).filter((r) => r.hotel).slice(0, 9);
        // Build initial list from featured
        let chosen = await Promise.all(rows.map(async (r) => {
          const h = r.hotel!;
          const resolvedImg = r.image_url || (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || "/seal.svg";
          return {
            slug: String(h.slug),
            name: String(h.name),
            city: String(h.city || ''),
            country: String(h.country || ''),
            rating: typeof h.rating === 'number' ? h.rating : 0,
            price: typeof h.price === 'number' ? h.price : NaN,
            _cosy: Number(r.score) || 0,
            _img: resolvedImg,
            affiliateUrl: (h.affiliate_url as string | null) || "",
          };
        }));

        // If fewer than 9 featured rows, top up from Supabase cosy_scores (score_final first)
        if (chosen.length < 9) {
          type MS = { score: number | null; score_final: number | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; affiliate_url: string | null } | null };
          const excludeSlugs = new Set(chosen.map((c) => c.slug));
          const { data: more } = await supabase
            .from("cosy_scores")
            .select("score, score_final, hotel:hotel_id (id,slug,name,city,country,rating,price,affiliate_url)")
            .order("score_final", { ascending: false, nullsFirst: false })
            .order("score", { ascending: false })
            .limit(50);
          const moreRows = ((more || []) as unknown as MS[])
            .filter((r) => r.hotel && !excludeSlugs.has(String(r.hotel!.slug)))
            .slice(0, 9 - chosen.length);
          const moreChosen = await Promise.all(moreRows.map(async (r) => {
            const h = r.hotel!;
            const resolvedImg = await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id)) || "/seal.svg";
            return {
              slug: String(h.slug),
              name: String(h.name),
              city: String(h.city || ''),
              country: String(h.country || ''),
              rating: typeof h.rating === 'number' ? h.rating : 0,
              price: typeof h.price === 'number' ? h.price : NaN,
              _cosy: typeof r.score_final === 'number' ? Number(r.score_final) : (typeof r.score === 'number' ? Number(r.score) : 0),
              _img: resolvedImg,
              affiliateUrl: (h.affiliate_url as string | null) || "",
            };
          }));
          chosen = chosen.concat(moreChosen).slice(0, 9);
        }
        const detailsHref = (slug: string) => `/${locale}/hotels/${slug}`;
        const renderTop = (h: typeof chosen[number]) => (
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
        return (
          <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
            <div className="col-span-full sr-only" aria-live="polite">
              Featured cosy places
            </div>
            {chosen.map(renderTop)}
          </div>
        );
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
    _cosy: adhocCosyScore({ rating: r.rating, summary: r.formatted_address, name: r.name, reviews: r.user_ratings_total }),
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

  // Front page: show the top 9 worldwide with Seal of approval (cosy >= 7) and apply diversity guard
  if (!city) filtered.sort((a, b) => b._cosy - a._cosy);
  let limited = filtered;
  // Limit search results to 21 for a tidy 3-column grid
  if (city) {
    limited = filtered.slice(0, 21);
  }
  if (!city) {
    const eligible = filtered.filter((h) => h._cosy >= 7.0);
    const chains = [
      "marriott","hilton","hyatt","accor","radisson","kempinski","four seasons","ritz-carlton","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham","premier inn","travelodge",
    ];
    const brandOf = (name: string) => {
      const hay = name.toLowerCase();
      for (const c of chains) if (hay.includes(c)) return c;
      return "independent";
    };
    const perCountry: Record<string, number> = {};
    const perBrand: Record<string, number> = {};
    const maxCountry = 3, maxBrand = 2;
    const pick: typeof eligible = [];
    for (const h of eligible) {
      const country = ("country" in h ? (h as { country?: string }).country : undefined) || '';
      const brand = brandOf(h.name);
      const cCount = perCountry[country] || 0;
      const bCount = perBrand[brand] || 0;
      if (cCount >= maxCountry || bCount >= maxBrand) continue;
      pick.push(h);
      perCountry[country] = cCount + 1;
      perBrand[brand] = bCount + 1;
      if (pick.length >= 9) break;
    }
    limited = pick.length >= 9 ? pick : eligible.slice(0, 9);
  }

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

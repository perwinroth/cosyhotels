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
    title: "Cosy Hotel Rooms & Boutique Hotels | Get Cosy",
    description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide. Curated picks with helpful filters.",
    openGraph: {
      title: "Cosy Hotel Rooms & Boutique Hotels",
      description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide.",
      type: "website",
      url: `/${params.locale}/hotels`,
      images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }],
    },
  };
}

export default function HotelsPage({
  searchParams,
  params,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  params: { locale: string };
}) {
  const cityParam = typeof searchParams.city === 'string' ? searchParams.city.trim() : '';
  const hasCity = !!cityParam;
  const h1 = hasCity ? `Cosy hotel in ${cityParam} – boutique stays` : `Cosy hotel rooms & boutique hotels`;
  const intro = hasCity
    ? `Find a cosy hotel in ${cityParam}. We surface intimate boutique stays with warm design, great reviews and that cosy feel.`
    : `Find cosy hotel rooms, boutique hotels, and romantic getaways across the world. Use the search and filters to uncover intimate stays with warm design and great reviews.`;

  const faqs = hasCity
    ? [
        { q: `What makes a cosy hotel in ${cityParam}?`, a: `Small scale, warm interiors, good reviews, and details like fireplaces, bathtubs, gardens or a quiet vibe.` },
        { q: `How do you pick boutique hotels in ${cityParam}?`, a: `We analyze reviews, amenities and language signals to score how cosy a place feels, then feature the best-rated ones.` },
        { q: `Are these romantic getaways in ${cityParam}?`, a: `Many of them are. Look for higher cosy scores and amenities like spa, sauna, bathtub or fireplaces.` },
      ]
    : [
        { q: `What makes a hotel feel cosy?`, a: `Small scale, warm interiors, great reviews and design details like fireplaces, bathtubs, gardens or a quiet vibe.` },
        { q: `How do you choose boutique hotels?`, a: `We analyze reviews, amenities and language signals to score how cosy a place feels, then feature the best-rated ones.` },
        { q: `Are these good for romantic getaways?`, a: `Yes—many of our top cosy picks are ideal for couples weekends with spa, sauna or soaking tubs.` },
      ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{h1}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Get Cosy',
            url: `/${params.locale}/hotels`,
            potentialAction: {
              '@type': 'SearchAction',
              target: `/${params.locale}/hotels?city={search_term_string}`,
              'query-input': 'required name=search_term_string'
            }
          })
        }}
      />
      <p className="mt-2 max-w-3xl text-zinc-600 text-sm md:text-base">{intro}</p>
      <p className="mt-1 text-sm text-zinc-600">
        Curious about the badge? <a href={`/${params.locale}/cosy-score#seal`} className="underline">See how the Seal of approval works</a>.
      </p>
      {/* Search under intro */}
      <div className="mt-4">
        <SearchBar locale={params.locale} />
      </div>
      <div className="mt-4">
        <Results searchParams={searchParams} locale={params.locale} />
      </div>
      {/* FAQ at the bottom */}
      <section className="mt-8">
        <details className="rounded-lg border border-zinc-200 bg-white p-3 md:p-4">
          <summary className="cursor-pointer font-medium">Frequently asked questions</summary>
          <div className="mt-2 space-y-3">
            {faqs.map((f, i) => (
              <div key={`faq-${i}`}>
                <div className="font-medium">{f.q}</div>
                <p className="text-sm text-zinc-600">{f.a}</p>
              </div>
            ))}
          </div>
        </details>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            }),
          }}
        />
      </section>
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
    // City search: fetch up to 3 pages; add slight delays for next_page_token activation
    const first = await searchText(`cosy boutique hotel in ${city}`);
    let results = (first.results || []);
    if (first.next_page_token) {
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const second = await searchText("", first.next_page_token);
        results = results.concat(second.results || []);
        if (second.next_page_token) {
          await new Promise((r) => setTimeout(r, 1500));
          const third = await searchText("", second.next_page_token);
          results = results.concat(third.results || []);
        }
      } catch {}
    }
    let tmp = results.slice(0, 60).map((r) => makePlace(r, city));
    // If Supabase has entries for these Place IDs, override scores with persisted score_final/score for consistency
    try {
      const supabase = getServerSupabase();
      if (supabase && tmp.length) {
        const ids = tmp.map((p) => String(p.id));
        const { data: rows } = await supabase
          .from('hotels')
          .select('source_id, cosy_scores ( score, score_final )')
          .in('source_id', ids);
        const byId = new Map<string, number>();
        type ScoreEmbed = { score: unknown; score_final: unknown } | Array<{ score: unknown; score_final: unknown }> | null;
        const getVal = (cs: ScoreEmbed): number | null => {
          if (!cs) return null;
          if (Array.isArray(cs)) {
            const first = cs[0];
            if (!first) return null;
            const sf = typeof first.score_final === 'number' ? first.score_final : null;
            const s = typeof first.score === 'number' ? first.score : null;
            return (sf ?? s);
          }
          const sf = typeof cs.score_final === 'number' ? cs.score_final : null;
          const s = typeof cs.score === 'number' ? cs.score : null;
          return (sf ?? s);
        };
        for (const row of (rows || []) as Array<{ source_id: string | null; cosy_scores: ScoreEmbed }>) {
          const v = getVal(row.cosy_scores);
          if (row.source_id && typeof v === 'number') byId.set(String(row.source_id), v);
        }
        if (byId.size) {
          tmp = tmp.map((p) => (byId.has(String(p.id)) ? { ...p, _cosy: byId.get(String(p.id)) as number } : p));
        }
      }
    } catch {}
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
    // Front page: broaden queries heavily and fetch multiple pages with delays so we always exceed 9 eligible
    const baseQueries = [
      // English
      "cosy boutique hotel","cozy boutique hotel","charming boutique hotel","romantic boutique hotel","small boutique hotel","intimate hotel",
      // FR/ES/IT/PT/DE/NL/JP/SE/DK/NO
      "hôtel de charme","hôtel cosy","hotel con encanto","albergo di charme","hotel romantico","hotel romântico","gemütliches hotel","kleines hotel",
      "knus hotel","gezellig hotel","ryokan","minshuku","mysigt hotell","hyggeligt hotel","koselig hotell",
    ];
    const regional = [
      "in Europe","in Asia","in Japan","in Italy","in France","in Greece","in Spain","in Portugal","in Thailand","in Indonesia","in Mexico","in Morocco",
    ];
    const queries: string[] = [];
    for (const q of baseQueries) queries.push(q);
    for (const q of baseQueries.slice(0, 8)) for (const r of regional) queries.push(`${q} ${r}`);

    // Helper to fetch up to 3 pages with token delays
    async function fetchAllPages(q: string, pages = 3) {
      const first = await searchText(q);
      let res: PlaceSearchResult[] = first.results || [];
      let token = first.next_page_token;
      for (let i = 1; i < pages && token; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const next = await searchText("", token);
        res = res.concat(next.results || []);
        token = next.next_page_token;
      }
      return res;
    }

    const seenPlace = new Set<string>();
    const picked: PlaceSearchResult[] = [];
    for (const q of queries) {
      const res = await fetchAllPages(q, 2); // 2 pages per query to balance latency
      for (const r of res) {
        if (!r.place_id || seenPlace.has(r.place_id)) continue;
        seenPlace.add(r.place_id);
        picked.push(r);
        if (picked.length >= 600) break; // larger safety cap
      }
      if (picked.length >= 600) break;
    }
    let tmp = picked.map((r) => makePlace(r));
    // Override with Supabase scores when available for consistency
    try {
      const supabase = getServerSupabase();
      if (supabase && tmp.length) {
        const ids = tmp.map((p) => String(p.id));
        const { data: rows } = await supabase
          .from('hotels')
          .select('source_id, cosy_scores ( score, score_final )')
          .in('source_id', ids);
        const byId = new Map<string, number>();
        type ScoreEmbed = { score: unknown; score_final: unknown } | Array<{ score: unknown; score_final: unknown }> | null;
        const getVal = (cs: ScoreEmbed): number | null => {
          if (!cs) return null;
          if (Array.isArray(cs)) {
            const first = cs[0];
            if (!first) return null;
            const sf = typeof first.score_final === 'number' ? first.score_final : null;
            const s = typeof first.score === 'number' ? first.score : null;
            return (sf ?? s);
          }
          const sf = typeof cs.score_final === 'number' ? cs.score_final : null;
          const s = typeof cs.score === 'number' ? cs.score : null;
          return (sf ?? s);
        };
        for (const row of (rows || []) as Array<{ source_id: string | null; cosy_scores: ScoreEmbed }>) {
          const v = getVal(row.cosy_scores);
          if (row.source_id && typeof v === 'number') byId.set(String(row.source_id), v);
        }
        if (byId.size) {
          tmp = tmp.map((p) => (byId.has(String(p.id)) ? { ...p, _cosy: byId.get(String(p.id)) as number } : p));
        }
      }
    } catch {}
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
    // If we still don't have 9 (few eligible >=7), top up from overall filtered list
    if (pick.length < 9) {
      for (const h of filtered) {
        if (pick.includes(h)) continue;
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
    }
    // Final fallback: just take top 9 regardless of diversity if still short
    limited = pick.length >= 9 ? pick : filtered.slice(0, 9);
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

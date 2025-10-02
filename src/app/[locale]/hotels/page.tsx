// Hotels listing (Supabase-only; no Google Places or fallbacks)
export const revalidate = 300; // cache SSR for 5 minutes (front page)
import { SearchBar } from "@/components/HomeSections";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { messages } from "@/i18n/messages";
import { cityGuides } from "@/data/cityGuides";
import { getImageForHotel } from "@/lib/hotelImages";
import HotelTile from "@/components/HotelTile";
import { getServerSupabase } from "@/lib/supabase/server";

// Type guard to narrow out nulls from arrays
function nonNull<T>(x: T | null | undefined): x is T { return x != null; }

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/hotels`]),
    ["x-default", "/en/hotels"],
  ]);
  return {
    alternates: { canonical: `/${params.locale}/hotels`, languages },
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
  const m = messages[params.locale as keyof typeof messages] ?? messages.en;
  const h1 = hasCity ? (m.hotels?.h1_city?.replace('{city}', cityParam) || `Cosy hotel in ${cityParam} – boutique stays`) : (m.hotels?.h1_generic || 'Cosy hotel rooms & boutique hotels');
  const intro = hasCity
    ? (m.hotels?.intro_city?.replace('{city}', cityParam) || `Find a cosy hotel in ${cityParam}. We surface intimate boutique stays with warm design, great reviews and that cosy feel.`)
    : (m.hotels?.intro_generic || `Find cosy hotel rooms, boutique hotels, and romantic getaways across the world. Use the search and filters to uncover intimate stays with warm design and great reviews.`);

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

      <div className="mt-4"><SearchBar locale={params.locale} /></div>
      <div className="mt-4"><Results searchParams={searchParams} locale={params.locale} /></div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Popular guides</h2>
        <ul className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {cityGuides.slice(0, 12).map((g) => (
            <li key={g.slug}>
              <a className="block rounded border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50" href={`/${params.locale}/guides/${g.slug}`}>
                {g.city} cosy hotels
              </a>
            </li>
          ))}
        </ul>
      </section>

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
              mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
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
}: { searchParams: { [key: string]: string | string[] | undefined }; locale: string }) {
  const params = searchParams;
  const city = typeof params.city === "string" && params.city.trim() ? params.city.trim() : undefined;
  const amenities = Array.isArray(params.amenity)
    ? (params.amenity as string[])
    : typeof params.amenity === "string"
    ? [params.amenity]
    : undefined;
  type Sort = "cosy-desc" | "cosy-asc";
  const allowedSort: ReadonlyArray<Sort> = ["cosy-desc", "cosy-asc"];
  const isSort = (v: unknown): v is Sort => typeof v === "string" && allowedSort.includes(v as Sort);
  const sort: Sort = isSort(params.sort) ? (params.sort as Sort) : "cosy-desc";

  // Front page: Featured top 9, else top from cosy_scores
  if (!city) {
    const supabase = getServerSupabase();
    if (supabase) {
      type FTRow = { position: number; score: number | null; image_url: string | null; hotel_id: string };
      type HotelBasic = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; affiliate_url: string | null };
      type CosyRow = { hotel_id: string; score: number | null; score_final: number | null };
      const { data: frows, error } = await supabase
        .from("featured_top")
        .select("position, score, image_url, hotel_id")
        .order("position", { ascending: true })
        .limit(9);
      if (!error && frows && frows.length) {
        const ids = (frows as unknown as FTRow[]).map((r) => String(r.hotel_id));
        const { data: hotelsRows } = await supabase
          .from("hotels")
          .select("id,slug,name,city,country,rating,price,affiliate_url")
          .in("id", ids);
        const byId = new Map((hotelsRows as HotelBasic[] | null | undefined || []).map((h) => [String(h.id), h]));
        const { data: cosyRows } = await supabase
          .from("cosy_scores")
          .select("hotel_id,score,score_final")
          .in("hotel_id", ids);
        const cosyMap = new Map((cosyRows as CosyRow[] | null | undefined || []).map((r) => [String(r.hotel_id), (typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null))]));
        let chosen = await Promise.all((frows as unknown as FTRow[]).map(async (r) => {
          const h = byId.get(String(r.hotel_id));
          if (!h) return null;
          const resolvedImg = r.image_url || (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || "/seal.svg";
          const cosy = cosyMap.get(String(h.id));
          const cosyDisplay = typeof cosy === 'number' ? cosy : (typeof r.score === 'number' ? r.score : null);
          return {
            slug: String(h.slug),
            name: String(h.name),
            city: String(h.city || ''),
            country: String(h.country || ''),
            rating: typeof h.rating === 'number' ? h.rating : 0,
            price: typeof h.price === 'number' ? h.price : NaN,
            _cosy: typeof cosyDisplay === 'number' ? cosyDisplay : 7.0,
            _img: resolvedImg,
            affiliateUrl: (h.affiliate_url as string | null) || "",
          };
        }));
        chosen = chosen.filter(nonNull).filter((c) => c._cosy >= 7.0);
        if (chosen.length) {
          const detailsHref = (slug: string) => `/${locale}/hotels/${slug}`;
          const renderTop = (h: typeof chosen[number], idx: number) => (
            <HotelTile
              key={`${h.slug}-${h._img}`}
              hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: h.rating, price: isFinite(h.price as number) ? (h.price as number) : undefined, image: h._img, cosy: h._cosy }}
              href={detailsHref(h.slug)}
              goHref={h.affiliateUrl ? `/go/${h.slug}` : undefined}
              priority={idx === 0}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
            />
          );
          return (
            <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
              <div className="col-span-full sr-only" aria-live="polite">Featured cosy places</div>
              {chosen.map((h, i) => renderTop(h, i))}
            </div>
          );
        }
      }
      // Direct top 9 from cosy_scores
      type TopRow = { score: number | null; score_final: number | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; affiliate_url: string | null } | null };
      const { data: topRows } = await supabase
        .from("cosy_scores")
        .select("score, score_final, hotel:hotel_id (id,slug,name,city,country,rating,price,affiliate_url)")
        .order("score_final", { ascending: false, nullsFirst: false })
        .order("score", { ascending: false })
        .limit(30);
      const candidates = ((topRows || []) as unknown as TopRow[])
        .filter((r) => r.hotel)
        .map((r) => ({ r, s: (typeof r.score_final === 'number' ? Number(r.score_final) : (typeof r.score === 'number' ? Number(r.score) : 0)) }))
        .filter(({ s }) => s >= 7.0);
      const seenTop = new Set<string>();
      const topNine = await Promise.all(candidates
        .filter(({ r }) => { const slug = String(r.hotel!.slug); if (seenTop.has(slug)) return false; seenTop.add(slug); return true; })
        .slice(0, 9)
        .map(async ({ r, s }) => {
          const h = r.hotel!;
          const resolvedImg = await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id)) || '/seal.svg';
          return {
            slug: String(h.slug),
            name: String(h.name),
            city: String(h.city || ''),
            country: String(h.country || ''),
            rating: typeof h.rating === 'number' ? h.rating : 0,
            price: typeof h.price === 'number' ? h.price : NaN,
            _cosy: s,
            _img: resolvedImg,
            affiliateUrl: (h.affiliate_url as string | null) || '',
          };
        }));
      if (topNine.length) {
        const detailsHref = (slug: string) => `/${locale}/hotels/${slug}`;
        return (
          <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
            <div className="col-span-full sr-only" aria-live="polite">Top cosy places</div>
            {topNine.map((h, i) => (
              <HotelTile
                key={`${h.slug}-${h._img}`}
                hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: h.rating, price: isFinite(h.price as number) ? (h.price as number) : undefined, image: h._img, cosy: h._cosy }}
                href={detailsHref(h.slug)}
                goHref={h.affiliateUrl ? `/go/${h.slug}` : undefined}
                priority={i === 0}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
              />
            ))}
          </div>
        );
      }
    }
  }

  // City search: Supabase-only
  if (city) {
    const supabase = getServerSupabase();
    if (supabase) {
      type HB = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; affiliate_url: string | null; amenities?: string[] | null };
      type CS = { hotel_id: string; score: number | null; score_final: number | null };
      let query = supabase
        .from('hotels')
        .select('id,slug,name,city,country,rating,price,affiliate_url,amenities')
        .ilike('city', `%${city}%`)
        .limit(200);
      const { data: hRows } = await query;
      let hotelsCity = ((hRows || []) as HB[]);
      if (amenities && amenities.length) {
        hotelsCity = hotelsCity.filter((h) => Array.isArray(h.amenities) ? amenities.every((a) => h.amenities!.includes(a)) : false);
      }
      const ids = hotelsCity.map((h) => String(h.id));
      const { data: sRows } = await supabase
        .from('cosy_scores')
        .select('hotel_id,score,score_final')
        .in('hotel_id', ids);
      const scoreMap = new Map<string, number>();
      for (const r of ((sRows || []) as CS[])) {
        const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
        if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
      }
      const ordered = hotelsCity
        .map((h) => ({ h, s: scoreMap.get(String(h.id)) ?? 0 }))
        .sort((a, b) => (sort === 'cosy-asc' ? a.s - b.s : b.s - a.s))
        .slice(0, 24);
      const list = await Promise.all(ordered.map(async ({ h, s }) => ({
        slug: String(h.slug),
        name: String(h.name),
        city: String(h.city || ''),
        country: String(h.country || ''),
        rating: typeof h.rating === 'number' ? h.rating : 0,
        price: typeof h.price === 'number' ? h.price : NaN,
        _cosy: s,
        _img: (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || '/seal.svg',
        affiliateUrl: (h.affiliate_url as string | null) || '',
      })));
      return (
        <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
          <div className="col-span-full sr-only" aria-live="polite">{list.length} result{list.length === 1 ? '' : 's'} in {city}</div>
          {list.map((h, i) => (
            <HotelTile
              key={`${h.slug}-${i}`}
              hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: h.rating, price: isFinite(h.price as number) ? (h.price as number) : undefined, image: h._img, cosy: h._cosy }}
              href={`/${locale}/hotels/${h.slug}`}
              goHref={h.affiliateUrl ? `/go/${h.slug}` : undefined}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
            />
          ))}
        </div>
      );
    }
  }
  // No city and no data: render nothing (no fallbacks)
  return <div className="grid md:grid-cols-3 gap-3 auto-rows-fr" />;
}


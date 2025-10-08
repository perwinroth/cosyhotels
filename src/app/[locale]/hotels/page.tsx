// Hotels listing (Amadeus-first; no Google Places)
export const revalidate = 300;
import { SearchBar } from "@/components/HomeSections";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { messages } from "@/i18n/messages";
import { cityGuides } from "@/data/cityGuides";
import HotelTile from "@/components/HotelTile";
import { amadeusSearchHotels, amadeusGetHotelDetails } from "@/lib/vendors/amadeus";
import { bookingSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";
import { cosyScore } from "@/lib/scoring/cosy";
import { getVendorImageAny } from "@/lib/imageVendor";

type Tile = {
  slug: string; name: string; city: string; country: string;
  rating: number; _cosy: number; _img: string; affiliateUrl: string;
}

function nonNull<T>(x: T | null | undefined): x is T { return x != null; }

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries([
    ...locales.map((l) => [l, `/${l}/hotels`]),
    ["x-default", "/en/hotels"],
  ]);
  return {
    alternates: { canonical: `/${params.locale}/hotels`, languages },
    title: "Cosy Hotel Rooms & Boutique Hotels | Get Cosy",
    description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide.",
    openGraph: {
      title: "Cosy Hotel Rooms & Boutique Hotels",
      description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide.",
      type: "website",
      url: `/${params.locale}/hotels`,
      images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }],
    },
  };
}

export default function HotelsPage({ searchParams, params }: { searchParams: { [k: string]: string | string[] | undefined }, params: { locale: string } }) {
  const cityParam = typeof searchParams.city === 'string' ? searchParams.city.trim() : '';
  const hasCity = !!cityParam;
  const m = messages[params.locale as keyof typeof messages] ?? messages.en;
  const h1 = hasCity ? (m.hotels?.h1_city?.replace('{city}', cityParam) || `Cosy hotel in ${cityParam} – boutique stays`) : (m.hotels?.h1_generic || 'Cosy hotel rooms & boutique hotels');
  const intro = hasCity
    ? (m.hotels?.intro_city?.replace('{city}', cityParam) || `Find a cosy hotel in ${cityParam}. We surface intimate boutique stays with warm design, great reviews and that cosy feel.`)
    : (m.hotels?.intro_generic || `Find cosy hotel rooms, boutique hotels, and romantic getaways across the world.`);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{h1}</h1>
      <p className="mt-2 max-w-3xl text-zinc-600 text-sm md:text-base">{intro}</p>
      <div className="mt-4"><SearchBar locale={params.locale} /></div>
      <div className="mt-4"><Results searchParams={searchParams} locale={params.locale} /></div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Popular guides</h2>
        <ul className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
          {cityGuides.slice(0, 12).map((g) => (
            <li key={g.slug}><a className="block rounded border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50" href={`/${params.locale}/guides/${g.slug}`}>{g.city} cosy hotels</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function cosyFromName(name: string): number {
  const n = name.toLowerCase();
  let score = 6.6;
  const boost = ["boutique","design","charm","charming","cozy","cosy","intimate","romantic","maison","atelier","residenza","palazzo"];
  const penal = ["marriott","hilton","hyatt","accor","radisson","kempinski","intercontinental","sheraton","ibis","novotel","mercure","holiday inn","best western","wyndham"];
  if (boost.some((k) => n.includes(k))) score += 0.8;
  if (penal.some((k) => n.includes(k))) score -= 0.8;
  return Math.max(5.0, Math.min(9.5, score));
}

async function buildTileFromAmadeus(id: string, fallbackName: string, fallbackCity: string, fallbackCountry: string): Promise<Tile | null> {
  const d = await amadeusGetHotelDetails(id);
  const name = (d?.name || fallbackName || '').trim();
  const city = (d?.city || fallbackCity || '').trim();
  const country = (d?.country || fallbackCountry || '').trim();
  if (!name) return null;
  const slug = `am-${id}`;
  const r10 = typeof d?.rating10 === 'number' ? d!.rating10 : NaN;
  const cosy = Number.isFinite(r10) ? cosyScore({ rating: r10 }) : cosyFromName(name);
  const media = Array.isArray(d?.images) && d!.images[0] ? d!.images[0] : null;
  const img = media || await getVendorImageAny(slug, name, city, country) || '/seal.svg';
  const affiliateUrl = buildAffiliateUrl(bookingSearchUrl({ name, city, country }));
  return { slug, name, city, country, rating: Number.isFinite(r10) ? r10 : 0, _cosy: cosy, _img: img, affiliateUrl };
}

async function Results({ searchParams, locale }: { searchParams: { [k: string]: string | string[] | undefined }, locale: string }) {
  const city = typeof searchParams.city === 'string' && searchParams.city.trim() ? searchParams.city.trim() : undefined;

  if (!city) {
    const seeds = ["Paris","Rome","Lisbon","Barcelona","Amsterdam","Berlin","Tokyo","Kyoto","New York"];
    const picks: Tile[] = [];
    for (const c of seeds) {
      const list = await amadeusSearchHotels(c);
      for (const s of list.slice(0, 16)) {
        const t = await buildTileFromAmadeus(s.id, s.name || '', c, '');
        if (t && t._cosy >= 7.0) picks.push(t);
        if (picks.length >= 12) break;
      }
      if (picks.length >= 12) break;
    }
    const top = picks.sort((a,b)=>b._cosy - a._cosy).slice(0, 9);
    return (
      <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
        <div className="col-span-full sr-only" aria-live="polite">Top cosy places</div>
        {top.map((h, i) => (
          <HotelTile
            key={`${h.slug}-${i}`}
            hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: h.rating, image: h._img, cosy: h._cosy }}
            href={`/${locale}/hotels/${h.slug}?name=${encodeURIComponent(h.name)}&city=${encodeURIComponent(h.city)}&country=${encodeURIComponent(h.country)}&img=${encodeURIComponent(h._img)}`}
            goHref={h.affiliateUrl}
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
          />
        ))}
      </div>
    );
  }

  // City search: top 21 by cosy
  const ids = await amadeusSearchHotels(city);
  const tiles: Tile[] = [];
  for (const s of ids.slice(0, 60)) {
    const t = await buildTileFromAmadeus(s.id, s.name || '', city, '');
    if (t) tiles.push(t);
  }
  const top = tiles.sort((a,b)=>b._cosy - a._cosy).slice(0, 21);
  return (
    <div className="grid md:grid-cols-3 gap-3 auto-rows-fr">
      <div className="col-span-full sr-only" aria-live="polite">{top.length} results in {city}</div>
      {top.map((h, i) => (
        <HotelTile
          key={`${h.slug}-${i}`}
          hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: h.rating, image: h._img, cosy: h._cosy }}
          href={`/${locale}/hotels/${h.slug}?name=${encodeURIComponent(h.name)}&city=${encodeURIComponent(h.city)}&country=${encodeURIComponent(h.country)}&img=${encodeURIComponent(h._img)}`}
          goHref={h.affiliateUrl}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
        />
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { normalizedScore } from "@/lib/normalization";
import { getImageForHotel } from "@/lib/hotelImages";
import HotelTile from "@/components/HotelTile";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const g = getGuide(params.slug);
  if (!g) {
    const cg = getCityGuide(params.slug);
    if (cg) {
      const title = `${cg.city} cosy hotels – 9 handpicked stays`;
      const description = `Our favourite cosy and romantic boutique hotels in ${cg.city}.`;
      const url = `/${params.locale}/guides/${cg.slug}`;
      const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${cg.slug}`]));
      return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary", title, description } };
    }
    return {};
  }
  const url = `/${params.locale}/guides/${g.slug}`;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${g.slug}`]));
  return {
    title: g.title,
    description: g.excerpt,
    alternates: { canonical: url, languages },
    openGraph: { title: g.title, description: g.excerpt, type: "article", url },
    twitter: { card: "summary", title: g.title, description: g.excerpt },
  };
}

export default async function GuidePage({ params }: Props) {
  const g = getGuide(params.slug);
  if (g) {
    return (
      <article className="prose prose-zinc mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2">{g.title}</h1>
        <p className="text-zinc-600">{g.excerpt}</p>
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: g.body }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.excerpt, mainEntityOfPage: { '@type': 'WebPage', '@id': `/guides/${g.slug}` } }),
          }}
        />
      </article>
    );
  }
  const cg = getCityGuide(params.slug);
  if (!cg) return <div className="mx-auto max-w-6xl px-4 py-8">Guide not found.</div>;

  // Fetch from Supabase and normalize for consistency with front page
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  type Row = { score: number; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; price: number | null; website: string | null; reviews_count: number | null } | null };
  const { data } = await db
    .from("cosy_scores")
    .select("score, hotel:hotel_id (id,slug,name,city,country,rating,price,website,reviews_count)")
    .ilike("hotel.city", `%${cg.city}%`)
    .order("score", { ascending: false })
    .limit(120);
  const rows = (data || []) as unknown as Row[];
  const { data: stats } = await db.from("normalizer_stats").select("scope,key,median,iqr");
  const cityStats = new Map<string, { m: number; i: number }>();
  const countryStats = new Map<string, { m: number; i: number }>();
  ((stats as unknown as { scope: string; key: string; median: number; iqr: number }[]) || []).forEach((s) => {
    if (s.scope === 'city') cityStats.set(s.key, { m: Number(s.median), i: Number(s.iqr) });
    if (s.scope === 'country') countryStats.set(s.key, { m: Number(s.median), i: Number(s.iqr) });
  });
  const scored = rows.map((r) => {
    const h = r.hotel; if (!h) return null;
    const base = Number(r.score) || 0;
    const cs = cityStats.get(String(h.city || '')) || { m: base, i: 1 };
    const ks = countryStats.get(String(h.country || '')) || { m: base, i: 1 };
    const normCity = normalizedScore(base, cs.m, cs.i);
    const normCountry = normalizedScore(base, ks.m, ks.i);
    const reviews = typeof (h.reviews_count as number | null) === 'number' ? (h.reviews_count as number) : 0;
    const conf = Math.max(0.6, Math.min(1.0, Math.log10(1 + reviews) / 2));
    const final = (0.5 * base + 0.3 * normCity + 0.2 * normCountry) * conf;
    return { hotel: h, _cosy: final };
  }).filter(Boolean) as Array<{ hotel: NonNullable<Row['hotel']>; _cosy: number }>;
  scored.sort((a, b) => b._cosy - a._cosy);
  const chosen = await Promise.all(scored.slice(0, 9).map(async (s) => ({
    slug: String(s.hotel.slug),
    name: String(s.hotel.name),
    city: String(s.hotel.city || ''),
    country: String(s.hotel.country || ''),
    rating: typeof s.hotel.rating === 'number' ? s.hotel.rating : 0,
    _cosy: s._cosy,
    _img: (await getImageForHotel(String(s.hotel.name), String(s.hotel.city || ''), 800, String(s.hotel.slug), String(s.hotel.id))) || "/seal.svg",
  })));

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{cg.city} cosy hotels</h1>
      <p className="mt-2 text-zinc-600">9 handpicked cosy and romantic stays in {cg.city}.</p>
      <div className="mt-6 grid md:grid-cols-3 gap-3 auto-rows-fr">
        {chosen.map((h) => (
          <HotelTile
            key={`${h.slug}-${h._img}`}
            hotel={{ slug: String(h.slug), name: h.name, city: h.city, country: h.country, rating: h.rating, image: h._img, cosy: h._cosy }}
            href={detailsHref(h.slug)}
            goHref={`/go/${h.slug}`}
          />
        ))}
      </div>
    </div>
  );
}

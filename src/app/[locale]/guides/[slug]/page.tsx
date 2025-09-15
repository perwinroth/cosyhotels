import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { searchText, getDetails, photoUrl } from "@/lib/places";
import { adhocCosyScore } from "@/lib/scoring/cosy";
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

  // Fetch and rank cosy hotels for this city from Google Places
  const data = await searchText(`cosy boutique hotel in ${cg.city}`);
  const base = (data.results || []);
  // enrich images for items missing a photo
  const items = await Promise.all(base.map(async (r) => {
    let img = r.photos?.[0]?.photo_reference ? photoUrl(r.photos[0].photo_reference, 800) : "/seal.svg";
    if (img === "/seal.svg") {
      try { const d = await getDetails(r.place_id); const ref = d?.photos?.[0]?.photo_reference; if (ref) img = photoUrl(ref, 800); } catch {}
    }
    return {
      slug: r.place_id,
      name: r.name,
      city: (r.formatted_address || '').split(',')[0]?.trim() || cg.city,
      country: (() => { const parts = (r.formatted_address || '').split(',').map(s=>s.trim()).filter(Boolean); return parts.length ? parts[parts.length-1] : ''; })(),
      rating: r.rating || 0,
      _cosy: adhocCosyScore({ rating: r.rating, summary: r.formatted_address, name: r.name }),
      _img: img,
    };
  }));
  // keep only high ones and pick top 9
  const high = items.filter((i) => i._cosy >= 7.5).sort((a,b)=> b._cosy - a._cosy);
  const chosen = (high.length >= 9 ? high.slice(0,9) : items.sort((a,b)=> b._cosy - a._cosy).slice(0,9));

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

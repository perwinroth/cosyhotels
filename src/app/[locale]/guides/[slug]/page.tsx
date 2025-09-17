import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
// using precomputed city_top; no direct Places calls
import { buildCosySnippet } from "@/i18n/snippets";
import Image from "next/image";
import { getImageForHotel } from "@/lib/hotelImages";
import { translate } from "@/lib/i18n/translate";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = getGuide(params.slug);
  if (!g) {
    const cg = getCityGuide(params.slug);
    if (cg) {
      const titleBase = `${cg.city} cosy hotels – 9 handpicked stays`;
      const descBase = `Our favourite cosy and romantic boutique hotels in ${cg.city}.`;
      const title = params.locale === 'en' ? titleBase : await translate(titleBase, params.locale);
      const description = params.locale === 'en' ? descBase : await translate(descBase, params.locale);
      const url = `/${params.locale}/guides/${cg.slug}`;
      const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${cg.slug}`]));
      return { title, description, alternates: { canonical: url, languages }, openGraph: { title, description, type: "article", url }, twitter: { card: "summary", title, description } };
    }
    return {};
  }
  const url = `/${params.locale}/guides/${g.slug}`;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${g.slug}`]));
  const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
  const description = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
  return {
    title,
    description,
    alternates: { canonical: url, languages },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary", title, description },
  };
}

export default async function GuidePage({ params }: Props) {
  const g = getGuide(params.slug);
  if (g) {
    const title = params.locale === 'en' ? g.title : await translate(g.title, params.locale);
    const excerpt = params.locale === 'en' ? g.excerpt : await translate(g.excerpt, params.locale);
    return (
      <article className="prose prose-zinc mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2">{title}</h1>
        <p className="text-zinc-600">{excerpt}</p>
        <div className="mt-6" dangerouslySetInnerHTML={{ __html: g.body }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: title, description: excerpt, mainEntityOfPage: { '@type': 'WebPage', '@id': `/guides/${g.slug}` } }),
          }}
        />
      </article>
    );
  }
  const cg = getCityGuide(params.slug);
  if (!cg) return <div className="mx-auto max-w-6xl px-4 py-8">Guide not found.</div>;

  // Fetch precomputed top cosy hotels for the city from Supabase (city_top)
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  type CT = { rank: number; score: number; image_url: string | null; rating5: number | null; reviews_count: number | null; cues: string[] | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; } | null };
  const { data } = await db
    .from('city_top')
    .select('rank, score, image_url, rating5, reviews_count, cues, hotel:hotel_id (id,slug,name,city,country)')
    .eq('city', cg.city)
    .order('rank', { ascending: true })
    .limit(9);
  let chosen = ((data || []) as unknown as CT[]).filter((r) => r.hotel).map((r) => {
    const h = r.hotel!;
    const cueKeys = (r.cues || []) as string[];
    const snippet = buildCosySnippet(params.locale, {
      city: String(h.city || cg.city),
      name: String(h.name),
      rating: r.rating5 ?? undefined,
      reviewsCount: r.reviews_count ?? undefined,
      cues: cueKeys,
      idealLevel: 'warm',
    });
    return {
      slug: String(h.slug),
      name: String(h.name),
      city: String(h.city || ''),
      country: String(h.country || ''),
      rating: 0,
      _cosy: Number(r.score) || 0,
      _img: r.image_url || '/seal.svg',
      snippet,
    };
  });

  // Fallback: if city_top not yet populated, compute top 9 on the fly
  if (chosen.length === 0) {
    type HR = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; cosy_scores: { score: number | null; score_final: number | null } | { score: number | null; score_final: number | null }[] | null };
    const { data: rows } = await db
      .from('hotels')
      .select('id,slug,name,city,country,rating, cosy_scores ( score, score_final )')
      .ilike('city', `%${cg.city}%`)
      .limit(120);
    const hotels = (rows || []) as HR[];
    const scoreOf = (cs: HR['cosy_scores']) => {
      if (!cs) return 0;
      if (Array.isArray(cs)) {
        const first = cs[0]; if (!first) return 0;
        return Number((first.score_final ?? first.score) || 0);
      }
      return Number((cs.score_final ?? cs.score) || 0);
    };
    const ranked = hotels
      .map((h) => ({ h, s: scoreOf(h.cosy_scores) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 9);
    chosen = await Promise.all(ranked.map(async ({ h, s }) => {
      const img = (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || '/seal.svg';
      const snippet = buildCosySnippet(params.locale, {
        city: String(h.city || cg.city),
        name: String(h.name),
        rating: typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined,
        reviewsCount: undefined,
        cues: [],
        idealLevel: 'warm',
      });
      return { slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), rating: 0, _cosy: s, _img: img, snippet };
    }));
  }

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{cg.city} cosy hotels</h1>
      <p className="mt-2 text-zinc-600">9 handpicked cosy and romantic stays in {cg.city}.</p>
      <ol className="mt-6 space-y-6">
        {chosen.map((h, idx) => (
          <li key={`${h.slug}-${h._img}`} className="border border-zinc-200 rounded-xl bg-white">
            <div className="p-3 md:p-4">
              <div className="flex items-baseline gap-3">
                <div className="text-xl font-semibold tabular-nums">{idx + 1}.</div>
                <h2 className="text-xl font-semibold">
                  <a href={detailsHref(h.slug)} className="hover:underline">{h.name}</a>
                </h2>
              </div>
              <p className="mt-2 text-sm text-zinc-700">{h.snippet}</p>
            </div>
            <a href={detailsHref(h.slug)}>
              <div className="relative w-full aspect-[4/3] rounded-b-xl overflow-hidden">
                <Image src={h._img} alt={`${h.name} – ${h.city}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 1200px" />
              </div>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
export const revalidate = 600;

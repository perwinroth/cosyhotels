import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";
import { getDetails } from "@/lib/places";
import { buildCosySnippet } from "@/i18n/snippets";
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

  // Fetch top cosy hotels for the city from Supabase
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  type HR = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; website: string | null; reviews_count: number | null; source_id: string | null; cosy_scores: { score: number | null; score_final: number | null } | { score: number | null; score_final: number | null }[] | null };
  const { data } = await db
    .from('hotels')
    .select('id,slug,name,city,country,rating,website,reviews_count,source_id, cosy_scores ( score, score_final )')
    .ilike('city', `%${cg.city}%`)
    .limit(120);
  const hotels = (data || []) as unknown as HR[];
  const coalesceScore = (cs: HR['cosy_scores']) => {
    if (!cs) return 0;
    if (Array.isArray(cs)) {
      const first = cs[0]; if (!first) return 0;
      return (typeof first.score_final === 'number' ? first.score_final : (typeof first.score === 'number' ? first.score : 0)) as number;
    }
    return (typeof cs.score_final === 'number' ? cs.score_final : (typeof cs.score === 'number' ? cs.score : 0)) as number;
  };
  const ranked = hotels
    .map((h) => ({ h, score: coalesceScore(h.cosy_scores) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 9);

  const chosen = await Promise.all(
    ranked.map(async ({ h, score }) => {
      const img = (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || "/seal.svg";
      // Build a cosy snippet using Places details if available
      let snippet = `${h.name} is among the cosiest hotels in ${h.city || cg.city}.`;
      try {
        if (h.source_id) {
          const d = await getDetails(h.source_id);
          if (d) {
            const r5 = d.rating ?? (typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined);
            const reviews = d.user_ratings_total ?? h.reviews_count ?? undefined;
            const txt = `${d.editorial_summary?.overview || ''} ${d.formatted_address || ''}`.toLowerCase();
            const cues: string[] = [];
            if (txt.includes('spa')) cues.push('a soothing spa');
            if (txt.includes('sauna')) cues.push('a calming sauna');
            if (txt.includes('bathtub') || txt.includes('soaking') || txt.includes('bath')) cues.push('soaking tubs');
            if (txt.includes('fireplace')) cues.push('fireside warmth');
            if (txt.includes('garden')) cues.push('a quiet garden');
            if (txt.includes('rooftop')) cues.push('a rooftop view');
            const cueKeys: string[] = [];
            if (cues.includes('a soothing spa')) cueKeys.push('spa');
            if (cues.includes('a calming sauna')) cueKeys.push('sauna');
            if (cues.includes('soaking tubs')) cueKeys.push('tubs');
            if (cues.includes('fireside warmth')) cueKeys.push('fireplace');
            if (cues.includes('a quiet garden')) cueKeys.push('garden');
            if (cues.includes('a rooftop view')) cueKeys.push('rooftop');
            snippet = buildCosySnippet(params.locale, {
              city: h.city || cg.city,
              name: h.name,
              rating: r5,
              reviewsCount: reviews || undefined,
              cues: cueKeys.slice(0,2),
              idealLevel: 'warm',
            });
          }
        }
      } catch {}
      return {
        slug: String(h.slug),
        name: String(h.name),
        city: String(h.city || ''),
        country: String(h.country || ''),
        rating: typeof h.rating === 'number' ? h.rating : 0,
        _cosy: score,
        _img: img,
        snippet,
      };
    })
  );

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
              <img src={h._img} alt={`${h.name} – ${h.city}`} className="w-full aspect-[4/3] object-cover rounded-b-xl" />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

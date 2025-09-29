import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { getCityGuide } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
// using precomputed city_top; no direct Places calls
import { buildCosySnippet } from "@/i18n/snippets";
import Image from "next/image";
import { getImageForHotel } from "@/lib/hotelImages";
import { cosyScore } from "@/lib/scoring/cosy";
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
  let cg = getCityGuide(params.slug);
  if (!cg) {
    // Build a lightweight city guide from slug aliases so guides never 404
    const slug = params.slug.toLowerCase();
    const aliases: Record<string, string> = {
      'new-york': 'New York', 'nyc': 'New York', 'new-york-city': 'New York',
      'san-francisco': 'San Francisco', 'sf': 'San Francisco',
      'los-angeles': 'Los Angeles', 'la': 'Los Angeles',
    };
    const pretty = aliases[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    cg = { city: pretty, slug: params.slug } as unknown as ReturnType<typeof getCityGuide>;
  }
  const cityName = String((cg as { city: string }).city);

  // Fetch precomputed top cosy hotels for the city from Supabase (city_top)
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-6xl px-4 py-8">Server not configured.</div>;
  // Build robust city match (handle variants like "New York City" / "NYC")
  const cityVariants = (name: string) => {
    const n = name.trim();
    const lower = n.toLowerCase();
    const out = new Set<string>([n]);
    if (lower === 'new york' || lower.includes('new york') || lower === 'nyc') {
      ['New York City', 'NYC', 'Manhattan', 'New York'].forEach((v) => out.add(v));
    }
    return Array.from(out);
  };
  const orFilter = (variants: string[]) => variants.map((v) => `city.ilike.%${v}%`).join(',');
  type CT = { rank: number; score: number; image_url: string | null; rating5: number | null; reviews_count: number | null; cues: string[] | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; } | null };
  const { data } = await db
    .from('city_top')
    .select('rank, score, image_url, rating5, reviews_count, cues, hotel:hotel_id (id,slug,name,city,country)')
    .or(orFilter(cityVariants(cityName)))
    .order('rank', { ascending: true })
    .limit(12);
  // Start with precomputed city_top (enforced cosy >= 7 just in case)
  let chosen = ((data || []) as unknown as CT[])
    .filter((r) => r.hotel && Number(r.score) >= 7.0)
    .map((r) => {
      const h = r.hotel!;
      const cueKeys = (r.cues || []) as string[];
      const snippet = buildCosySnippet(params.locale, {
        city: String(h.city || cityName),
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

  // Fallback / top-up: if fewer than 9, query hotels+scores for this city and fill to 9 (cosy >= 7)
  if (chosen.length < 9) {
    type HB = { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null };
    type CS = { hotel_id: string; score: number | null; score_final: number | null };
    // Two-step RLS-safe fetch: hotels by city variants, then cosy_scores by hotel_id
    const { data: hRows } = await db
      .from('hotels')
      .select('id,slug,name,city,country,rating')
      .or(orFilter(cityVariants(cityName)))
      .limit(400);
    const hotels: HB[] = (hRows || []) as HB[];
    const ids = hotels.map((h) => String(h.id));
    const { data: sRows } = await db
      .from('cosy_scores')
      .select('hotel_id,score,score_final')
      .in('hotel_id', ids);
    const scoreMap = new Map<string, number>();
    for (const r of (sRows || []) as CS[]) {
      const v = typeof r.score_final === 'number' ? r.score_final : (typeof r.score === 'number' ? r.score : null);
      if (r.hotel_id && typeof v === 'number') scoreMap.set(String(r.hotel_id), Number(v));
    }
    const missing = 9 - chosen.length;
    if (missing > 0) {
      const seen = new Set(chosen.map((c) => c.slug));
      const ranked = hotels
        .map((h) => ({ h, s: scoreMap.get(String(h.id)) ?? 0 }))
        .filter((x) => x.s >= 7.0)
        .sort((a, b) => b.s - a.s);
      const topUp = await Promise.all(ranked
        .filter(({ h }) => !seen.has(String(h.slug)))
        .slice(0, missing)
        .map(async ({ h, s }) => {
          const img = (await getImageForHotel(String(h.name), String(h.city || ''), 800, String(h.slug), String(h.id))) || '/seal.svg';
          const snippet = buildCosySnippet(params.locale, {
            city: String(h.city || cityName),
            name: String(h.name),
            rating: typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined,
            reviewsCount: undefined,
            cues: [],
            idealLevel: 'warm',
          });
          return { slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), rating: 0, _cosy: s, _img: img, snippet };
        }));
      chosen = chosen.concat(topUp);
    }
  }

  // Final guarantee: if still < 9, top up from curated dataset for THIS city only (cosy >= 7)
  if (chosen.length < 9) {
    // Lazy import to avoid heavier bundle
    const { hotels: curated } = await import("@/data/hotels");
    const seen = new Set(chosen.map((c) => c.slug));
    // Enrich curated with cosy and image to avoid Places
    const enriched = await Promise.all(curated
      .filter((h) => (h.city || '').toLowerCase().includes(cityName.toLowerCase()))
      .map(async (h) => ({
        ...h,
        _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
        _img: h.image || (await getImageForHotel(h.name, h.city, 800, h.slug, h.id)) || '/seal.svg',
      }))
    );
    const byCity = enriched.filter((h) => h._cosy >= 7.0).sort((a, b) => b._cosy - a._cosy);
    for (const h of byCity) {
      if (seen.has(String(h.slug))) continue;
      chosen.push({ slug: String(h.slug), name: String(h.name), city: String(h.city || ''), country: String(h.country || ''), rating: 0, _cosy: Number(h._cosy) || 0, _img: String(h._img || '/seal.svg'), snippet: buildCosySnippet(params.locale, { city: String(h.city || cityName), name: String(h.name), rating: typeof h.rating === 'number' ? Number(h.rating) / 2 : undefined, reviewsCount: undefined, cues: [], idealLevel: 'warm' }) });
      seen.add(String(h.slug));
      if (chosen.length >= 9) break;
    }
  }

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{cityName} cosy hotels</h1>
      <p className="mt-2 text-zinc-600">9 handpicked cosy and romantic stays in {cityName}.</p>
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

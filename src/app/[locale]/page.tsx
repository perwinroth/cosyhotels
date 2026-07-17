import { site } from "@/config/site";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import HotelCard from "@/components/HotelCard";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { translate, translateMany } from "@/lib/i18n/translate";
import { getServerSupabase } from "@/lib/supabase/server";
import { badLinkHotelIds } from "@/lib/linkQuality";
import { cityGuides } from "@/data/cityGuides";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { stay22AllezUrl } from "@/lib/affiliates";
import { SearchBar } from "@/components/HomeSections";
import { isLatin } from "@/lib/placeText";
import { getDelistedSlugSet } from "@/lib/delisted";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  // Untranslated locales are duplicate English; only the root "/" homepage is indexed. Every
  // locale homepage canonicalizes to "/" (and drops hreflang, valid only for real translations).
  return {
    alternates: { canonical: `/` },
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
  };
}

type TopHotel = { slug: string; name: string; name_en?: string | null; city: string; country: string; cosy: number; description: string; image?: string; lat?: number | null; lng?: number | null; website?: string | null };
type CityChip = { city: string; slug: string; count: number };

// Live COSY-scored count per curated city guide — same predicate the guide page uses to decide it
// renders. A chip must only link cities whose guide actually renders (>= 1 pick); the old raw
// city/address count could show a chip for a city with 0 cosy hotels → the guide 404s.
async function cityChips(): Promise<CityChip[]> {
  const rows = await Promise.all(
    cityGuides.map(async (g) => ({ city: g.city, slug: g.slug, count: await liveCosyCountForCityName(g.city) }))
  );
  return rows.filter((r) => r.count >= 1).sort((a, b) => b.count - a.count);
}

async function topHotels(db: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<TopHotel[]> {
  type Row = { score: number | null; score_final: number | null; description: string | null; imagery_warmth: number | null; hotel: { id: string; slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat: number | null; lng: number | null; website: string | null } | null };
  // Only PHOTO-VERIFIED hotels (imagery_warmth set) headline the homepage — never an un-grounded
  // blind score. A 10.0 with no photo we ever looked at is not something to put at #1.
  const { data } = await db
    .from("cosy_scores")
    .select("score, score_final, description, imagery_warmth, hotel:hotel_id (id,slug,name,name_en,city,country,lat,lng,website)")
    .gt("imagery_warmth", 0)
    .order("score_final", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(120);
  const bad = await badLinkHotelIds(db);
  const delisted = await getDelistedSlugSet(db);
  const list = ((data || []) as unknown as Row[]).filter((r) => !!r.hotel?.slug && !bad.has(String(r.hotel!.id)) && !delisted.has(r.hotel!.slug));
  // The top three must SHOW a real, vision-approved photo (vision_ok=true) — a high score with no
  // displayable image doesn't belong at #1. Pull the approved photo for the candidates first, then
  // pick the highest-scoring ones that actually have one.
  const candIds = list.map((r) => r.hotel!.id);
  const imgBy = new Map<string, string>();
  for (let i = 0; i < candIds.length; i += 200) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", candIds.slice(i, i + 200)).eq("vision_ok", true);
    for (const row of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      if (row.hotel_id && row.url && !imgBy.has(String(row.hotel_id))) imgBy.set(String(row.hotel_id), row.url);
    }
  }
  const seen = new Set<string>();
  const picks: TopHotel[] = [];
  for (const r of list) {
    const h = r.hotel!;
    if (seen.has(h.slug)) continue;
    const image = imgBy.get(String(h.id));
    if (!image) continue; // require a real, vision-approved photo
    seen.add(h.slug);
    picks.push({
      slug: h.slug,
      name: h.name,
      name_en: h.name_en,
      city: h.city || "",
      country: h.country || "",
      cosy: typeof r.score_final === "number" ? r.score_final : Number(r.score) || 0,
      description: r.description || "",
      image,
      lat: h.lat, lng: h.lng, website: h.website,
    });
    if (picks.length >= 3) break;
  }
  return picks;
}

export default async function Home({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const db = getServerSupabase();

  let chips: CityChip[] = [];
  let top: TopHotel[] = [];
  if (db) {
    [chips, top] = await Promise.all([cityChips(), topHotels(db)]);
    top = top.filter((h) => isLatin(h.name_en || h.name)); // English site: skip non-Latin-named hotels
  }
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): fail-safe empty set by default.
  const wrongSlugs = await getStay22WrongSlugs(db);
  const saveLabels = await buildSaveLabels(locale);
  // Fallback chips from the curated list if the DB is unavailable.
  const heroChips = (chips.length ? chips : cityGuides.map((g) => ({ city: g.city, slug: g.slug, count: 0 }))).slice(0, 6);

  // Reader-facing chrome routes through translate() for non-en locales; en short-circuits before any
  // await (English pays zero translation cost). Source strings are British English, no em/en dashes.
  const isEn = locale === "en";
  const CHROME = {
    heroSub: "Sure we do: our AI ranks hotels on cosiness, not stars.",
    card1t: "AI reads every hotel",
    card1d: "Photos, reviews, amenities, room count and setting, all judged together, not in isolation.",
    card2t: "Cosiness signals are weighted",
    card2d: "Fireplaces, warm light, soft textiles, intimate scale, scored on one 0–10 cosy scale.",
    card3t: "You book one with soul",
    card3d: "We surface the cosiest, explain why, and link you straight to availability.",
    staysLove: "Cosy stays we love",
    staysSub: "High cosy scores, with a real photo to match",
    exploreGuides: "Explore all city guides",
    searchPlaceholder: "Search a hotel or city…",
    searchBtn: "Search",
    searching: "Searching…",
    areas: "Areas",
    countries: "Countries",
    cities: "Cities",
    cosyHotelsIn: "Cosy hotels in",
  };
  let L = CHROME;
  if (!isEn) {
    const keys = Object.keys(CHROME) as (keyof typeof CHROME)[];
    const vals = await Promise.all(keys.map((k) => translate(CHROME[k], locale)));
    L = Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as typeof CHROME;
  }
  // Homepage hotel descriptions render in the target language too (pure sv cache hit; en untouched).
  const topDescs = isEn ? top.map((h) => h.description) : await translateMany(top.map((h) => h.description), locale);

  return (
    <div>
      {/* HERO */}
      <section className="text-center px-4" style={{ padding: "74px 16px 58px", background: "radial-gradient(1100px 420px at 50% -8%, color-mix(in srgb, var(--ember) 13%, transparent), transparent 70%)" }}>
        <h1 className="font-display font-semibold mx-auto" style={{ fontSize: "clamp(44px, 7vw, 66px)", lineHeight: 1.02, letterSpacing: "-0.025em", maxWidth: 780 }}>
          Got <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--ember)" }}>cosy?</span>
        </h1>
        <p className="mt-4 mx-auto text-lg" style={{ color: "var(--muted)", maxWidth: 560, lineHeight: 1.5 }}>
          {L.heroSub}
        </p>
        <div className="mt-7 mx-auto" style={{ maxWidth: 580 }}>
          <Suspense fallback={<div className="h-12 rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--card)" }} />}>
            <SearchBar locale={locale} labels={{ placeholder: L.searchPlaceholder, searchBtn: L.searchBtn, searching: L.searching, areas: L.areas, countries: L.countries, cities: L.cities, cosyHotelsIn: L.cosyHotelsIn }} />
          </Suspense>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {heroChips.map((c) => (
            <Link key={c.slug} href={`/${locale}/guides/${c.slug}`} prefetch={false} className="hov text-sm px-4 py-2 rounded-full border no-underline" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              {c.city}
            </Link>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        {/* HOW IT WORKS */}
        <section className="mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { n: "1", t: L.card1t, d: L.card1d },
              { n: "2", t: L.card2t, d: L.card2d },
              { n: "3", t: L.card3t, d: L.card3d },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex-none flex items-center justify-center rounded-xl font-display font-semibold text-lg" style={{ background: "var(--sage)", color: "#fff", width: 42, height: 42 }}>{s.n}</div>
                  <h3 className="font-display text-lg font-medium">{s.t}</h3>
                </div>
                <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HIGHEST COSY SCORES */}
        {top.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display text-2xl font-semibold">{L.staysLove}</h2>
              <span className="text-sm" style={{ color: "var(--muted)" }}>{L.staysSub}</span>
            </div>
            <ol className="space-y-3">
              {top.map((h, i) => {
                const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat ?? null, lng: h.lng ?? null, campaign: `home-${locale}` });
                return (
                  <HotelCard
                    key={h.slug}
                    slug={h.slug}
                    name={h.name_en || h.name}
                    city={h.city}
                    country={h.country}
                    score={h.cosy}
                    snippet={topDescs[i]}
                    clampSnippet
                    photo={h.image}
                    locale={locale}
                    saveLabels={saveLabels}
                    stay22Href={cta}
                    website={h.website}
                    isVerifiedWrong={wrongSlugs.has(h.slug)}
                    shareTitle={`${h.name_en || h.name}, a cosy hotel in ${h.city}`}
                    shareUrl={`/${locale}/hotels/${h.slug}`}
                  />
                );
              })}
            </ol>
            <div className="text-center mt-6">
              <Link href={`/${locale}/guides`} prefetch={false} className="inline-block rounded-xl px-7 py-3 font-medium no-underline" style={{ color: "var(--ember)", border: "1px solid color-mix(in srgb, var(--ember) 35%, transparent)" }}>{L.exploreGuides} →</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

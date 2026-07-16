import { site } from "@/config/site";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import HotelActions from "@/components/HotelActions";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { getServerSupabase } from "@/lib/supabase/server";
import { badLinkHotelIds } from "@/lib/linkQuality";
import { cityGuides } from "@/data/cityGuides";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { stay22AllezUrl } from "@/lib/affiliates";
import { SearchBar } from "@/components/HomeSections";
import { placeLine, isLatin } from "@/lib/placeText";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { getDelistedSlugSet } from "@/lib/delisted";
import { getStay22WrongSlugs } from "@/lib/ctaPolicy";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  // Untranslated locales are duplicate English; only the root "/" homepage is indexed. Every
  // locale homepage canonicalizes to "/" (and drops hreflang, valid only for real translations).
  return {
    alternates: { canonical: `/` },
    title: `${site.name} – ${site.tagline}`,
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

  return (
    <div>
      {/* HERO */}
      <section className="text-center px-4" style={{ padding: "74px 16px 58px", background: "radial-gradient(1100px 420px at 50% -8%, color-mix(in srgb, var(--ember) 13%, transparent), transparent 70%)" }}>
        <h1 className="font-display font-semibold mx-auto" style={{ fontSize: "clamp(44px, 7vw, 66px)", lineHeight: 1.02, letterSpacing: "-0.025em", maxWidth: 780 }}>
          Got <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--ember)" }}>cosy?</span>
        </h1>
        <p className="mt-4 mx-auto text-lg" style={{ color: "var(--muted)", maxWidth: 560, lineHeight: 1.5 }}>
          Sure we do: our AI ranks hotels on cosiness, not stars.
        </p>
        <div className="mt-7 mx-auto" style={{ maxWidth: 580 }}>
          <Suspense fallback={<div className="h-12 rounded-2xl border" style={{ borderColor: "var(--line)", background: "var(--card)" }} />}>
            <SearchBar locale={locale} />
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
              { n: "1", t: "AI reads every hotel", d: "Photos, reviews, amenities, room count and setting, all judged together, not in isolation." },
              { n: "2", t: "Cosiness signals are weighted", d: "Fireplaces, warm light, soft textiles, intimate scale, scored on one 0–10 cosy scale." },
              { n: "3", t: "You book one with soul", d: "We surface the cosiest, explain why, and link you straight to availability." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
                <div className="flex items-center justify-center rounded-xl font-display font-semibold text-lg" style={{ background: "var(--sage)", color: "#fff", width: 42, height: 42 }}>{s.n}</div>
                <h3 className="mt-3.5 font-display text-lg font-medium">{s.t}</h3>
                <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HIGHEST COSY SCORES */}
        {top.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="font-display text-2xl font-semibold">Cosy stays we love</h2>
              <span className="text-sm" style={{ color: "var(--muted)" }}>High cosy scores, with a real photo to match</span>
            </div>
            <ol className="space-y-3">
              {top.map((h, i) => {
                const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat ?? null, lng: h.lng ?? null, campaign: `home-${locale}` });
                return (
                  <li key={h.slug} className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
                    <div className="flex items-start gap-5">
                      <span className="text-sm tabular-nums mt-1" style={{ color: "var(--muted)", width: 16 }}>{i + 1}</span>
                      <div className="flex-none hidden sm:flex flex-col items-center justify-center rounded-2xl font-display font-bold" style={{ width: 64, height: 64, background: cosyBadgeColor(h.cosy), color: "#fff", fontSize: 23 }}>
                        {h.cosy.toFixed(1)}<span style={{ fontFamily: "Inter", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", opacity: 0.8 }}>COSY</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="sm:hidden inline-flex items-center rounded-lg px-2 py-0.5 text-sm font-display font-bold text-white" style={{ background: cosyBadgeColor(h.cosy) }}>{h.cosy.toFixed(1)}<span style={{ fontFamily: "Inter", fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", opacity: 0.8, marginLeft: 3 }}>COSY</span></span>
                          <h3 className="font-display text-xl font-semibold leading-tight"><a href={`/${locale}/hotels/${h.slug}`} className="no-underline hover:underline">{h.name_en || h.name}</a></h3>
                        </div>
                        <div className="text-sm" style={{ color: "var(--muted)" }}>{placeLine(h.city, h.country)}</div>
                        {h.description && <p className="mt-2 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--foreground)" }}>{h.description}</p>}
                        {/* Button below the text so it never overlaps a long hotel name. */}
                        <HotelActions stay22Href={cta} website={h.website} isVerifiedWrong={wrongSlugs.has(h.slug)} hotelName={h.name} city={h.city} slug={h.slug} locale={locale} saveLabels={saveLabels} shareTitle={`${h.name_en || h.name}, a cosy hotel in ${h.city}`} shareUrl={`/${locale}/hotels/${h.slug}`} />
                      </div>
                      {h.image && (
                        <a href={`/${locale}/hotels/${h.slug}`} className="flex-none hidden sm:block no-underline">
                          <div className="relative rounded-xl overflow-hidden" style={{ width: 150, height: 112, border: "1px solid var(--line)" }}>
                            <Image src={h.image} alt={`${h.name_en || h.name}, ${h.city}`} fill className="object-cover" sizes="150px" quality={65} unoptimized={/^https?:\/\//.test(h.image)} />
                          </div>
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="text-center mt-6">
              <Link href={`/${locale}/guides`} prefetch={false} className="inline-block rounded-xl px-7 py-3 font-medium no-underline" style={{ color: "var(--ember)", border: "1px solid color-mix(in srgb, var(--ember) 35%, transparent)" }}>Explore all city guides →</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

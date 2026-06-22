import { site } from "@/config/site";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";
import { badLinkHotelIds } from "@/lib/linkQuality";
import { cityGuides } from "@/data/cityGuides";
import { stay22AllezUrl } from "@/lib/affiliates";
import { SearchBar } from "@/components/HomeSections";
import { placeLine, isLatin } from "@/lib/placeText";

// Warm cosy-score badge colour (gold = top → sage → olive → muted clay).
function cosyColor(s: number): string {
  if (s >= 9) return "#D8B25A";
  if (s >= 7.8) return "#7FB7A2";
  if (s >= 6.8) return "#7c8a5f";
  if (s >= 5.6) return "#b07a4a";
  return "#a89b8c";
}

export const revalidate = 3600;

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const { locale } = params;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}`]));
  return {
    alternates: { canonical: `/${locale}`, languages },
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
  };
}

type TopHotel = { slug: string; name: string; name_en?: string | null; city: string; country: string; cosy: number; description: string; image?: string; lat?: number | null; lng?: number | null };
type CityChip = { city: string; slug: string; count: number };

// Live hotel count per curated city guide (matches the guide page's city/address matching).
async function cityChips(db: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<CityChip[]> {
  const rows = await Promise.all(
    cityGuides.map(async (g) => {
      const { count } = await db
        .from("hotels")
        .select("id", { count: "exact", head: true })
        .or(`city.ilike.%${g.city}%,address.ilike.%${g.city}%`);
      return { city: g.city, slug: g.slug, count: count ?? 0 };
    })
  );
  return rows.filter((r) => r.count >= 3).sort((a, b) => b.count - a.count);
}

async function topHotels(db: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<TopHotel[]> {
  type Row = { score: number | null; score_final: number | null; description: string | null; hotel: { id: string; slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat: number | null; lng: number | null } | null };
  const { data } = await db
    .from("cosy_scores")
    .select("score, score_final, description, hotel:hotel_id (id,slug,name,name_en,city,country,lat,lng)")
    .order("score_final", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(20);
  const bad = await badLinkHotelIds(db);
  const list = ((data || []) as unknown as Row[]).filter((r) => !!r.hotel?.slug && !bad.has(String(r.hotel!.id)));
  const seen = new Set<string>();
  const picks: TopHotel[] = [];
  for (const r of list) {
    const h = r.hotel!;
    if (seen.has(h.slug)) continue;
    seen.add(h.slug);
    picks.push({
      slug: h.slug,
      name: h.name,
      name_en: h.name_en,
      city: h.city || "",
      country: h.country || "",
      cosy: typeof r.score_final === "number" ? r.score_final : Number(r.score) || 0,
      description: r.description || "",
      lat: h.lat, lng: h.lng,
    });
    if (picks.length >= 3) break;
  }
  // Attach a cached image where available.
  const ids = picks.length ? list.filter((r) => picks.some((p) => p.slug === r.hotel!.slug)).map((r) => r.hotel!.id) : [];
  if (ids.length) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids);
    const byId = new Map<string, string>();
    for (const row of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      if (row.hotel_id && row.url && !byId.has(String(row.hotel_id))) byId.set(String(row.hotel_id), row.url);
    }
    for (const r of list) {
      const p = picks.find((x) => x.slug === r.hotel!.slug);
      if (p) p.image = byId.get(r.hotel!.id);
    }
  }
  return picks;
}

export default async function Home({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const db = getServerSupabase();

  let chips: CityChip[] = [];
  let top: TopHotel[] = [];
  if (db) {
    [chips, top] = await Promise.all([cityChips(db), topHotels(db)]);
    top = top.filter((h) => isLatin(h.name_en || h.name)); // English site: skip non-Latin-named hotels
  }
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
          Sure we do — our AI ranks hotels on cosiness, not stars.
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
              { n: "1", t: "AI reads every hotel", d: "Photos, reviews, amenities, room count and setting — judged together, not in isolation." },
              { n: "2", t: "Cosiness signals are weighted", d: "Fireplaces, warm light, soft textiles, intimate scale — scored on one 0–10 cosy scale." },
              { n: "3", t: "You book one with soul", d: "We surface the cosiest, explain why, and link you straight to availability." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
                <div className="flex items-center justify-center rounded-xl font-display font-semibold text-lg" style={{ background: "var(--sage)", color: "#16201C", width: 42, height: 42 }}>{s.n}</div>
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
              <h2 className="font-display text-2xl font-semibold">Highest cosy scores</h2>
              <span className="text-sm" style={{ color: "var(--muted)" }}>The cosiest stays our AI has scored</span>
            </div>
            <ol className="space-y-3">
              {top.map((h, i) => {
                const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat ?? null, lng: h.lng ?? null, campaign: `home-${locale}` });
                return (
                  <li key={h.slug} className="rounded-2xl border p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
                    <div className="flex items-start gap-5">
                      <span className="text-sm tabular-nums mt-1" style={{ color: "var(--muted)", width: 16 }}>{i + 1}</span>
                      <div className="flex-none flex flex-col items-center justify-center rounded-2xl font-display font-bold" style={{ width: 64, height: 64, background: cosyColor(h.cosy), color: "#16201C", fontSize: 23 }}>
                        {h.cosy.toFixed(1)}<span style={{ fontFamily: "Inter", fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", opacity: 0.8 }}>COSY</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-xl font-semibold leading-tight"><a href={`/${locale}/hotels/${h.slug}`} className="no-underline hover:underline">{h.name_en || h.name}</a></h3>
                        <div className="text-sm" style={{ color: "var(--muted)" }}>{placeLine(h.city, h.country)}</div>
                        {h.description && <p className="mt-2 text-sm leading-relaxed line-clamp-2" style={{ color: "var(--foreground)" }}>{h.description}</p>}
                        {/* Button below the text so it never overlaps a long hotel name. */}
                        <a href={cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex mt-3 rounded-xl px-5 py-2.5 font-medium no-underline text-sm" style={{ background: "var(--ember)", color: "#16201C" }}>Check availability</a>
                      </div>
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

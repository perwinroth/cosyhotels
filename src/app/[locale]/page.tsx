import { site } from "@/config/site";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { locales } from "@/i18n/locales";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityGuides } from "@/data/cityGuides";
import HotelTile from "@/components/HotelTile";
import { SearchBar } from "@/components/HomeSections";

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

type TopHotel = { slug: string; name: string; city: string; country: string; cosy: number; signals: string[]; image?: string };
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
  type Row = { score: number | null; score_final: number | null; signals: string[] | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null } | null };
  const { data } = await db
    .from("cosy_scores")
    .select("score, score_final, signals, hotel:hotel_id (id,slug,name,city,country)")
    .order("score_final", { ascending: false, nullsFirst: false })
    .order("score", { ascending: false })
    .limit(20);
  const list = ((data || []) as unknown as Row[]).filter((r) => r.hotel?.slug);
  const seen = new Set<string>();
  const picks: TopHotel[] = [];
  for (const r of list) {
    const h = r.hotel!;
    if (seen.has(h.slug)) continue;
    seen.add(h.slug);
    picks.push({
      slug: h.slug,
      name: h.name,
      city: h.city || "",
      country: h.country || "",
      cosy: typeof r.score_final === "number" ? r.score_final : Number(r.score) || 0,
      signals: (r.signals || []).slice(0, 3),
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
  let totalHotels = 0;
  if (db) {
    [chips, top] = await Promise.all([cityChips(db), topHotels(db)]);
    const { count } = await db.from("hotels").select("id", { count: "exact", head: true });
    totalHotels = count ?? 0;
  }
  // Fallback chips from the curated list if the DB is unavailable.
  const heroChips = (chips.length ? chips : cityGuides.map((g) => ({ city: g.city, slug: g.slug, count: 0 }))).slice(0, 6);
  const browseChips = (chips.length ? chips : cityGuides.map((g) => ({ city: g.city, slug: g.slug, count: 0 }))).slice(0, 12);
  const citiesCovered = cityGuides.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* 1. HERO */}
      <section className="text-center py-8 md:py-12">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border" style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ember-ink)" }}>
          AI-rated for cosiness
        </span>
        <h1 className="mt-4 font-display text-4xl md:text-5xl font-semibold tracking-tight">Find your perfect cosy stay</h1>
        <p className="mt-3 mx-auto max-w-2xl text-base md:text-lg" style={{ color: "var(--muted)" }}>
          Every hotel scored by AI — warmth, character, intimacy. Not just stars.
        </p>
        <div className="mt-6 mx-auto max-w-2xl">
          <Suspense fallback={<div className="h-11 rounded-lg border" style={{ borderColor: "var(--line)", background: "var(--card)" }} />}>
            <SearchBar locale={locale} />
          </Suspense>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {heroChips.map((c) => (
            <Link key={c.slug} href={`/${locale}/guides/${c.slug}`} prefetch={false} className="text-sm px-3 py-1.5 rounded-full border no-underline hover:bg-[#f3ebde]" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              {c.city}
            </Link>
          ))}
        </div>
      </section>

      {/* 2. HOW IT WORKS */}
      <section className="mt-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { n: "1", t: "AI analyses each hotel", d: "Photos, reviews, amenities, room count, and setting — read together, not in isolation." },
            { n: "2", t: "Cosiness signals are weighted", d: "Fireplaces, warm lighting, soft furnishings, intimate size — scored on a single cosy scale." },
            { n: "3", t: "You find your perfect stay", d: "Browse by city, sort by score, and book through the hotel's booking link." },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border bg-card p-5" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
              <div className="flex items-center justify-center rounded-2xl text-white font-display text-lg" style={{ background: "var(--sage)", width: 44, height: 44 }}>{s.n}</div>
              <h3 className="mt-3 font-display text-lg font-medium">{s.t}</h3>
              <p className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. HIGHEST COSY SCORES */}
      {top.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">Highest cosy scores</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>The cosiest stays our AI has scored so far.</p>
          <div className="mt-5 grid md:grid-cols-3 gap-3 auto-rows-fr">
            {top.map((h) => (
              <HotelTile
                key={h.slug}
                hotel={{ slug: h.slug, name: h.name, city: h.city, country: h.country, rating: 0, image: h.image, cosy: h.cosy, signals: h.signals }}
                href={`/${locale}/hotels/${h.slug}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* 4. BROWSE BY CITY */}
      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">Browse by city</h2>
        <ul className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
          {browseChips.map((c) => (
            <li key={c.slug}>
              <Link href={`/${locale}/guides/${c.slug}`} prefetch={false} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 no-underline hover:bg-[#f3ebde]" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <span className="font-medium">{c.city}</span>
                {c.count > 0 && <span className="text-xs" style={{ color: "var(--muted)" }}>{c.count}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 5. STATS BAR */}
      <section className="mt-14 mb-4">
        <div className="grid grid-cols-3 gap-3 rounded-2xl border p-6 text-center" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          <div>
            <div className="font-display text-3xl font-semibold">{totalHotels ? totalHotels.toLocaleString() : "—"}</div>
            <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Hotels scored</div>
          </div>
          <div>
            <div className="font-display text-3xl font-semibold">{citiesCovered}</div>
            <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Cities covered</div>
          </div>
          <div>
            <div className="font-display text-3xl font-semibold">0–10</div>
            <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--muted)" }}>Cosy score scale</div>
          </div>
        </div>
      </section>
    </div>
  );
}

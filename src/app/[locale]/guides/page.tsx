import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { liveCosyCountForCityName } from "@/lib/seo/cityHotels";
import { cityPin } from "@/lib/social";
import { cityCopy } from "@/data/cityCopy";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const title = "Cosy hotel guides: find a cosy stay, city by city";
  const description = "Hand-picked, AI-scored cosy hotels in the world's most characterful cities: boutique, independent and romantic stays, ranked 0–10 for warmth and character.";
  // Untranslated pages: only /en is indexed, so canonical points at the /en twin (no hreflang).
  return { alternates: { canonical: `/en/guides` }, title, description, openGraph: { title, description, type: "website" } };
}

export default async function GuidesIndex({ params }: { params: { locale: string } }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const db = getServerSupabase();

  // Top vetted hotel photo per city (bounded concurrency).
  const heroByCity = new Map<string, string>();
  if (db) {
    const CONC = 6;
    for (let i = 0; i < cityGuides.length; i += CONC) {
      await Promise.all(cityGuides.slice(i, i + CONC).map(async (c) => {
        try {
          const pin = await cityPin(db, c.city, base);
          const p = pin.slides[0]?.photo;
          if (p) heroByCity.set(c.city, p.startsWith("/") ? base + p : p.replace(/&amp;/g, "&"));
        } catch { /* no photo yet — card renders without it */ }
      }));
    }
  }

  // Only list a city card when its guide actually renders (>= 1 live cosy pick) — a card linking a
  // 0-cosy city dead-ends users on the guide's notFound(). Same predicate the guide uses to gate.
  const renderableCities = new Set<string>();
  await Promise.all(
    cityGuides.map(async (c) => {
      if ((await liveCosyCountForCityName(c.city)) >= 1) renderableCities.add(c.city);
    })
  );
  const renderableGuides = cityGuides.filter((c) => renderableCities.has(c.city));

  const groups: Record<string, typeof cityGuides> = { Europe: [], "North America": [], "Asia-Pacific": [], Other: [] };
  for (const c of renderableGuides) (groups[c.region] ||= groups.Other).push(c);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-semibold">Find a cosy stay</h1>
      <p className="mt-2 text-muted">The world&apos;s most characterful cities, and the cosiest, most personal hotels in each, AI-scored 0–10 for warmth, character and intimacy.</p>

      {guides.length > 0 && (
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {guides.map((g) => (
            <Link key={g.slug} href={`/${params.locale}/guides/${g.slug}`} className="block rounded-xl border border-line p-4 hov">
              <h2 className="font-medium">{g.title}</h2>
              <p className="text-sm text-muted mt-1">{g.excerpt}</p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 space-y-10">
        {Object.entries(groups).map(([region, items]) => (
          items.length ? (
            <section key={region}>
              <h2 className="text-lg font-medium">{region}</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-5">
                {items.map((c) => {
                  const hero = heroByCity.get(c.city);
                  return (
                    <Link key={c.slug} href={`/${params.locale}/guides/${c.slug}`} className="group block rounded-2xl border border-line overflow-hidden hov" style={{ background: "var(--card)" }}>
                      <div className="relative w-full" style={{ aspectRatio: "16 / 9", background: "var(--line)" }}>
                        {hero && <Image src={hero} alt={`Cosy hotels in ${c.city}`} fill className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 100vw, 50vw" quality={62} unoptimized={/^https?:\/\//.test(hero)} />}
                      </div>
                      <div className="p-4">
                        <h3 className="font-display text-lg font-semibold">{c.city}</h3>
                        <p className="text-sm leading-relaxed mt-1.5" style={{ color: "var(--muted)" }}>{cityCopy(c.city)}</p>
                        <span className="inline-block mt-3 text-sm font-medium" style={{ color: "var(--ember)" }}>See the cosiest hotels in {c.city} →</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null
        ))}
      </div>
    </div>
  );
}

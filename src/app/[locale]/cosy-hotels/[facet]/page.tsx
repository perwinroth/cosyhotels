// Theme hub (WP3): "Cosy hotels {facet}" across every city — e.g. /en/cosy-hotels/fireplace.
// Ranks the cosiest hotels whose REAL signals/description support the theme, and links out to the
// per-city facet pages (/cosy-hotels/{facet}/{city}) that already exist — the internal-linking payoff.
import { cache } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { FACETS, facetBySlug, matchesFacet } from "@/lib/facets";
import { cityToSlug, cityFromSlug } from "@/lib/citySlug";
import { displayCity, isLatin } from "@/lib/placeText";
import { stay22AllezUrl } from "@/lib/affiliates";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";
import ShareButton from "@/components/ShareButton";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
const INDEX_MIN = 8; // a theme hub with fewer matches than this is noindexed (thin)

export function generateStaticParams() {
  return FACETS.map((f) => ({ facet: f.slug }));
}

type Row = { hotel_id: string; score: number | null; score_final: number | null; signals: string[] | null; description: string | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null; lat?: number | null; lng?: number | null } | null };
type Match = { id: string; slug: string; name: string; city: string; country: string; score: number; snippet: string; lat: number | null; lng: number | null };

// cache()'d so metadata + body share one scan. Scans the cosiest live hotels in score order and keeps
// those matching the facet; also tallies matches per (known) city for the per-city links.
const loadFacet = cache(async (facetSlug: string): Promise<{ hotels: Match[]; cities: Array<{ city: string; slug: string; n: number }> } | null> => {
  const facet = facetBySlug(facetSlug);
  const db = getServerSupabase();
  if (!facet || !db) return null;
  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, signals, description, hotel:hotel_id!inner(slug, name, name_en, city, country, lat, lng)")
    .gte("score", 5)
    .order("score", { ascending: false })
    .limit(4000); // the cosiest 4k live hotels — deep enough to surface every strong theme match
  const cityTally = new Map<string, { city: string; slug: string; n: number }>();
  const seen = new Set<string>();
  const hotels: Match[] = [];
  for (const r of (data || []) as unknown as Row[]) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    if (!matchesFacet(facet, r.signals, r.description)) continue;
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    seen.add(name);
    const city = displayCity(h.city);
    // Tally per KNOWN city (round-trips cleanly), so a per-city link never points at a 404.
    if (city) {
      const base = cityToSlug(city).replace(/-cosy-hotel$/, "");
      if (cityFromSlug(`${base}-cosy-hotel`)) {
        const cur = cityTally.get(base);
        if (cur) cur.n++; else cityTally.set(base, { city, slug: base, n: 1 });
      }
    }
    if (hotels.length < 60) hotels.push({ id: String(r.hotel_id), slug: h.slug, name, city, country: h.country || "", score: Number((r.score_final ?? r.score) || 0), snippet: r.description || "", lat: h.lat ?? null, lng: h.lng ?? null });
  }
  const cities = [...cityTally.values()].filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 24);
  return { hotels, cities };
});

export async function generateMetadata({ params }: { params: { locale: string; facet: string } }): Promise<Metadata> {
  const facet = facetBySlug(params.facet);
  if (!facet) return {};
  const res = await loadFacet(params.facet);
  const n = res?.hotels.length ?? 0;
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels/${facet.slug}`;
  const title = `Cosy hotels ${facet.label} — AI-ranked worldwide`;
  const description = `The cosiest hotels ${facet.label}, from around the world — each AI-scored 0–10 for warmth and character, ranked best first.`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url },
    twitter: { card: "summary", title, description },
    ...(n < INDEX_MIN ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ThemeHub({ params }: { params: { locale: string; facet: string } }) {
  const facet = facetBySlug(params.facet);
  if (!facet) notFound();
  const res = await loadFacet(params.facet);
  if (!res || res.hotels.length < 2) notFound();
  const { hotels, cities } = res;

  const db = getServerSupabase()!;
  const photo = new Map<string, string>();
  const ids = hotels.map((h) => h.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }

  const top = hotels[0];
  const intro = `The cosiest hotels ${facet.label} we've scored worldwide — ${top.name} leads at ${top.score.toFixed(1)}/10. Ranked by cosy score, backed by real signals and guest reviews.`;
  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList", name: `Cosy hotels ${facet.label}`, numberOfItems: hotels.length,
    itemListElement: hotels.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: { "@type": "Hotel", name: h.name, url: `${SITE}/${params.locale}/hotels/${h.slug}`, ...(photo.get(h.id) ? { image: photo.get(h.id) } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(h.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } } },
    })),
  };
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${params.locale}` },
    { name: "Cosy hotels", url: `/${params.locale}/cosy-hotels` },
    { name: `Cosy hotels ${facet.label}`, url: `/${params.locale}/cosy-hotels/${facet.slug}` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemList)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <nav className="text-sm" style={{ color: "var(--muted)" }}><a href={`/${params.locale}/cosy-hotels`} className="hover:underline">Cosy hotels</a> / {facet.label}</nav>
      <h1 className="mt-2 text-2xl font-semibold">Cosy hotels {facet.label}</h1>
      <p className="mt-2" style={{ color: "var(--muted)" }}>{intro}</p>

      {cities.length > 0 && (
        <section className="mt-5">
          <h2 className="text-sm font-medium" style={{ color: "var(--muted)" }}>By city</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {cities.map((c) => (
              <a key={c.slug} href={`/${params.locale}/cosy-hotels/${facet.slug}/${c.slug}`} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:underline" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                {c.city} <span className="tabular-nums" style={{ color: "var(--muted)" }}>{c.n}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <ol className="mt-6 space-y-3">
        {hotels.map((h, idx) => {
          const cta = stay22AllezUrl({ name: h.name, city: h.city, country: h.country, lat: h.lat, lng: h.lng, campaign: `theme-${facet.slug}` });
          const ph = photo.get(h.id);
          return (
            <li key={h.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2"><span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span><h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${h.slug}`} className="hover:underline">{h.name}</a></h2></div>
                  {h.city && <div className="text-sm" style={{ color: "var(--muted)" }}>{h.city}</div>}
                  {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
                  <div className="mt-3 flex items-center gap-2"><a href={cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>Check availability</a><ShareButton variant="icon" title={`${h.name} — cosy hotel ${facet.label}`} url={`/${params.locale}/hotels/${h.slug}`} /></div>
                </div>
                {ph && <a href={`/${params.locale}/hotels/${h.slug}`} className="flex-shrink-0 hidden sm:block"><div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}><Image src={ph} alt={h.name} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(ph)} /></div></a>}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-8 text-sm" style={{ color: "var(--muted)" }}>Browse cosy hotels by <a href={`/${params.locale}/cosy-hotels`} className="underline">theme and country</a>, or explore our <a href={`/${params.locale}/guides`} className="underline">city guides</a>.</p>
    </div>
  );
}

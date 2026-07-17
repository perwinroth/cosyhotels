// The Cosy Index — flagship, citable, link-worthy page: the world's cosiest hotels, AI-ranked.
// A data asset for backlinks/PR + AEO/GEO (schema.org ItemList of Hotel+Review). Indexed.
import type { Metadata } from "next";
import Image from "next/image";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry, isLatin } from "@/lib/placeText";
import { cityToSlug } from "@/lib/citySlug";
import { getDelistedSlugSet } from "@/lib/delisted";
import { guideCityHasLivePick } from "@/lib/seo/guidePicks";
import { translate } from "@/lib/i18n/translate";

export const revalidate = 3600;

const TITLE = "The Cosy Index: The World's Cosiest Hotels, AI-Ranked";
const DESC = "An AI-scored ranking of the world's cosiest hotels, rated 0–10 for warmth, character and intimacy, not stars. Updated continuously from real data.";
// The Index bar, aligned to the calibrated bell curve (scores top out at ~7.8, not 10) and to the
// Cosiness Report's headline (≥7.0 ≈ the cosiest 2.3%). A constant so a future rescore can't silently
// empty the page the way a hard-coded 8.0 did.
const INDEX_MIN = 7.0; // "makes the Index" — the standout tier

export async function generateMetadata(): Promise<Metadata> {
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-index`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "website", url }, twitter: { card: "summary_large_image", title: TITLE, description: DESC } };
}

type Row = { hotel_id: string; score: number | null; score_final: number | null; hotel: { slug: string; name: string; name_en: string | null; city: string | null; country: string | null } | null };

function cosyColor(s: number): string { return s >= 7.4 ? "#5c6b56" : s >= INDEX_MIN ? "#6f8159" : "#7c8a5f"; }

export default async function CosyIndexPage({ params }: { params: { locale: string } }) {
  const db = getServerSupabase();
  if (!db) return <div className="mx-auto max-w-5xl px-4 py-10">Server not configured.</div>;

  // Headline data-study stats — the citable facts for PR + GEO ("according to Got Cosy…").
  const cnt = async (gte?: number) => {
    let q = db.from("cosy_scores").select("*", { count: "exact", head: true });
    if (gte != null) q = q.gte("score", gte);
    const { count } = await q;
    return count || 0;
  };
  const [totalScored, clearBar, inIndex] = await Promise.all([cnt(), cnt(5), cnt(INDEX_MIN)]);
  const pctClear = totalScored ? Math.round((clearBar / totalScored) * 100) : 0;
  const pctIndex = totalScored ? (Math.round((inIndex / totalScored) * 1000) / 10) : 0;
  // Cosiest cities = most hotels reaching the Index tier (≥INDEX_MIN).
  const { data: cityRows } = await db.from("cosy_scores").select("hotel:hotel_id!inner(city)").gte("score", INDEX_MIN).limit(2000);
  const cityCount: Record<string, number> = {};
  for (const r of (cityRows || []) as unknown as Array<{ hotel: { city: string | null } | null }>) {
    const ci = displayCity(r.hotel?.city || "");
    if (ci) cityCount[ci] = (cityCount[ci] || 0) + 1;
  }
  // Pull a wider candidate pool than the 8 shown, then verify each through guideCityHasLivePick,
  // the guide page's OWN pick-determination, before linking it. `displayCity()` cleans obvious
  // postcode noise, but `cityCount` is keyed on hotels that individually clear INDEX_MIN (7.0), not
  // on whether the guide page's stricter exact-match TRUST filter accepts THAT hotel's raw city
  // value; a hotel driving a city's count here can still be the only one the guide rejects
  // (2026-07-16 link audit, see guidePicks.ts). Never link an unverified city.
  const cosiestCityCandidates = Object.entries(cityCount).sort((a, b) => b[1] - a[1]).slice(0, 24);
  const cosiestCityChecks = await Promise.all(
    cosiestCityCandidates.map(async ([city, n]) => ((await guideCityHasLivePick(db, city)) ? ([city, n] as [string, number]) : null)),
  );
  const cosiestCities = cosiestCityChecks.filter((c): c is [string, number] => c != null).slice(0, 8);

  const { data } = await db
    .from("cosy_scores")
    .select("hotel_id, score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, country)")
    .gte("score", INDEX_MIN)
    .order("score", { ascending: false })
    .limit(150);

  const rows = (data || []) as unknown as Row[];
  const delisted = await getDelistedSlugSet(db);
  const seen = new Set<string>();
  const picked: Array<{ id: string; slug: string; name: string; city: string; country: string; score: number }> = [];
  for (const r of rows) {
    const h = r.hotel; if (!h || !r.hotel_id) continue;
    if (delisted.has(h.slug)) continue; // takedown excludes listing surfaces
    const name = String(h.name_en || h.name || "").trim();
    if (!name || !isLatin(name) || seen.has(name)) continue;
    seen.add(name);
    picked.push({ id: String(r.hotel_id), slug: h.slug, name, city: displayCity(h.city), country: displayCountry(h.country), score: Number((r.score_final ?? r.score) || 0) });
  }
  // Fetch order is by raw `score`; the badge shows `score_final ?? score` (they differ by up to
  // ±0.2), so re-sort by the DISPLAYED score before ranking so the visible list descends by it.
  picked.sort((a, b) => b.score - a.score);

  // Real vetted photos for the picks.
  const photo = new Map<string, string>();
  const ids = picked.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 150) {
    const { data: imgs } = await db.from("hotel_images").select("hotel_id,url").in("hotel_id", ids.slice(i, i + 150)).eq("vision_ok", true);
    for (const im of (imgs || []) as Array<{ hotel_id: string | null; url: string | null }>) {
      const hid = im.hotel_id ? String(im.hotel_id) : ""; const u = im.url || "";
      if (hid && u && !u.includes("placehold.co") && !photo.has(hid)) photo.set(hid, u);
    }
  }
  const list = picked.filter((p) => photo.has(p.id)).slice(0, 50);

  // Verify each distinct city named in the list before linking its guide (same reasoning as
  // cosiestCities above): a plain hotel-city string is exactly as likely to carry OSM postcode
  // noise as the aggregated ones. Deduped so one DB round-trip per unique city, not per hotel.
  const listCityNames = Array.from(new Set(list.map((p) => p.city).filter(Boolean)));
  const listCityLive = new Map<string, boolean>(
    await Promise.all(listCityNames.map(async (city): Promise<[string, boolean]> => [city, await guideCityHasLivePick(db, city)])),
  );

  // Reader-facing chrome routes through translate() for non-en locales; en short-circuits before
  // any await (founder, 2026-07-17: /sv/cosy-index rendered wholly in English). Stat sentences with
  // interpolated numbers are translated as {n}-placeholder TEMPLATES so the cache never explodes
  // per distinct count (numbers change hourly via revalidate).
  const isEn = params.locale === "en";
  const CH = {
    h1: "The Cosy Index",
    heroPre: "We've AI-scored",
    heroMid: "hotels for cosiness: warmth, character and intimacy, not stars.",
    heroBar: "clear the cosy bar; only",
    heroIndex: "make the Index.",
    statScored: "hotels scored for cosiness",
    statClear: "clear the cosy bar ({n})",
    statIndex: "made the Index ({n}+)",
    citiesH2: "The world's cosiest cities",
    citiesIntro: "Ranked by how many hotels reach the Index ({n}+ cosy score).",
    listH2: "The {n} cosiest hotels in the world",
    howH2: "How the Cosy Index works",
    howBody: "Every hotel is scored by AI on the signals that actually make a stay cosy: small room counts, fireplaces and soaking tubs, natural materials, intimate design, and reviews where guests feel genuinely welcomed rather than processed. Scores run 0-10, calibrated against hundreds of hand-graded hotels; the very cosiest top out around 7.8, and clearing {n} puts a hotel in the Index. Browse the full rankings by city in our",
    cityGuidesLink: "cosy hotel guides",
    howTail: "Americans spell it cozy; the Index scores the feeling, not the spelling.",
  };
  let LC = CH;
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const vals = await Promise.all(keys.map((k) => translate(CH[k], params.locale)));
    LC = Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as typeof CH;
  }
  const statClear = LC.statClear.replace("{n}", clearBar.toLocaleString());
  const statIndex = LC.statIndex.replace("{n}", INDEX_MIN.toFixed(1));
  const citiesIntro = LC.citiesIntro.replace("{n}", INDEX_MIN.toFixed(1));
  const listH2 = LC.listH2.replace("{n}", String(list.length));
  const howBody = LC.howBody.replace("{n}", INDEX_MIN.toFixed(1));

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "ItemList", name: TITLE, numberOfItems: list.length,
    itemListElement: list.map((p, i) => ({
      "@type": "ListItem", position: i + 1,
      item: {
        "@type": "Hotel", name: p.name, url: `${siteUrl}/${params.locale}/hotels/${p.slug}`, image: photo.get(p.id),
        ...(p.city || p.country ? { address: { "@type": "PostalAddress", ...(p.city ? { addressLocality: p.city } : {}), ...(p.country ? { addressCountry: p.country } : {}) } } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: Number(p.score.toFixed(1)), bestRating: 10, worstRating: 0, name: "Cosy score" } },
      },
    })),
  };
  const datasetLd = {
    "@context": "https://schema.org", "@type": "Dataset",
    name: "The Cosy Index: AI cosiness scores for 17,000+ hotels",
    description: `An AI-generated dataset scoring ${totalScored.toLocaleString()} hotels worldwide for cosiness (warmth, intimacy and character) on a 0–10 scale. ${clearBar.toLocaleString()} (${pctClear}%) clear the cosy bar (5+); ${inIndex.toLocaleString()} reach the Index (${INDEX_MIN.toFixed(1)}+).`,
    creator: { "@type": "Organization", name: "Got Cosy", url: siteUrl },
    url: `${siteUrl}/${params.locale}/cosy-index`,
    keywords: ["cosy hotels", "boutique hotels", "hotel rankings", "cosiness score", "romantic hotels", "cosiest cities"],
    variableMeasured: "Cosy Score (0–10)",
    isAccessibleForFree: true,
    license: `${siteUrl}`,
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
      <h1 className="text-3xl font-semibold tracking-tight">{LC.h1}</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>{LC.heroPre} <strong style={{ color: "var(--foreground)" }}>{totalScored.toLocaleString()}</strong> {LC.heroMid} {clearBar.toLocaleString()} ({pctClear}%) {LC.heroBar} <strong style={{ color: "var(--foreground)" }}>{inIndex.toLocaleString()}</strong> ({pctIndex}%) {LC.heroIndex}</p>

      {/* Headline stats — answer-first, citable facts for press + AI answer engines. */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          { n: totalScored.toLocaleString(), l: LC.statScored },
          { n: `${pctClear}%`, l: statClear },
          { n: inIndex.toLocaleString(), l: statIndex },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <div className="font-display text-2xl font-bold" style={{ color: "var(--ember)" }}>{s.n}</div>
            <div className="text-xs mt-1 leading-snug" style={{ color: "var(--muted)" }}>{s.l}</div>
          </div>
        ))}
      </div>

      {cosiestCities.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">{LC.citiesH2}</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>{citiesIntro}</p>
          <ol className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {cosiestCities.map(([city, n], i) => (
              <li key={city} className="rounded-lg border px-3 py-2 text-sm flex items-center justify-between gap-2" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <a href={`/${params.locale}/guides/${cityToSlug(city)}`} className="hover:underline truncate"><span style={{ color: "var(--muted)" }}>{i + 1}.</span> {city}</a>
                <span className="tabular-nums" style={{ color: "var(--ember)", fontWeight: 600 }}>{n}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="mt-12 text-xl font-semibold">{listH2}</h2>
      <ol className="mt-4 space-y-3">
        {list.map((p, i) => (
          <li key={p.id} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <div className="flex items-center gap-4">
              <span className="text-sm tabular-nums w-6 text-center" style={{ color: "var(--muted)" }}>{i + 1}</span>
              <div className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyColor(p.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 21, fontWeight: 600 }}>{p.score.toFixed(1)}</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold leading-tight"><a href={`/${params.locale}/hotels/${p.slug}`} className="hover:underline">{p.name}</a></h2>
                {(p.city || p.country) && <div className="text-sm" style={{ color: "var(--muted)" }}>{p.city && (listCityLive.get(p.city) ? <a href={`/${params.locale}/guides/${cityToSlug(p.city)}`} className="hover:underline">{p.city}</a> : <span>{p.city}</span>)}{p.city && p.country ? ", " : ""}{p.country}</div>}
              </div>
              {photo.get(p.id) && (
                <a href={`/${params.locale}/hotels/${p.slug}`} className="flex-shrink-0 hidden sm:block">
                  <div className="relative rounded-lg overflow-hidden" style={{ width: 110, height: 82 }}>
                    <Image src={photo.get(p.id)!} alt={p.name} fill className="object-cover" sizes="110px" quality={60} unoptimized={/^https?:\/\//.test(photo.get(p.id)!)} />
                  </div>
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">{LC.howH2}</h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{howBody} <a href={`/${params.locale}`} className="underline">{LC.cityGuidesLink}</a>. {LC.howTail}</p>
      </section>
    </div>
  );
}

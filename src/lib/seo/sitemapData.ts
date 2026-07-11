// Shared data + XML helpers for the split sitemaps (WP1).
// Rules: only INDEXABLE, canonical /en URLs; never emit a URL that 404s or is noindexed.
// The hotel gate here (cosy_scores.score >= 5) is the SAME gate the hotel page uses to decide
// index vs noindex, so the sitemap and the pages can never disagree.
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { getVisibleBlogPosts } from "@/lib/blogSchedule";
import { CONCEPT_BY_SLUG, LEGACY_FACET_SLUGS, REGEX_FACET_SLUGS, cityCollectionMin } from "@/lib/travellerFit";
import { cityFromSlug } from "@/lib/citySlug";
import { loadCountryCounts, HUB_MIN } from "@/lib/countryHub";
import { REGIONS } from "@/data/regions";
import { cityMembers, cityBaseSlug, resolveCity, liveCosyCountForCityName, CITY_HOTEL_SELECT, THEME_HUB_INDEX_MIN, collectionConcepts, conceptMembers, loadConceptAssignments, rpcCityUniverse, type ScoreHotelRow } from "@/lib/seo/cityHotels";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
export type Url = { loc: string; lastmod?: string; changefreq?: string; priority?: number };
const nowIso = () => new Date().toISOString();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

// ——— Static, evergreen pages (canonical /en) ———
export function staticUrls(): Url[] {
  const p = (path: string, priority = 0.6, changefreq = "monthly"): Url => ({ loc: `${SITE}${path}`, lastmod: nowIso(), changefreq, priority });
  // NB: no "/en" (it canonicalizes to "/") and no "/en/collections" (it 307-redirects to /en) —
  // a sitemap must never list a canonicalized-away or redirected URL.
  return [
    { loc: `${SITE}/`, lastmod: nowIso(), changefreq: "weekly", priority: 1.0 },
    p("/en/cosiness-report", 0.9, "weekly"),
    p("/en/cosy-index", 0.8, "weekly"),
    p("/en/what-makes-a-hotel-cosy", 0.7),
    p("/en/cosy-score", 0.6),
    p("/en/cosy-hotels", 0.7, "weekly"),
    p("/en/guides", 0.5),
    p("/en/for-hotels", 0.5),
    p("/en/press", 0.4),
    p("/en/make-your-hotel-look-cosy", 0.6),
    p("/en/blog", 0.6, "weekly"),
  ];
}

// ——— City / editorial guides (canonical /en only) ———
// City guides are noindexed by the page when they have <3 live cosy hotels, so we apply the SAME
// gate here (via the shared count helper) — the sitemap never lists a noindexed thin guide.
// Editorial guides are always indexable (no thin gate on the page), so they're listed unconditionally.
export async function cityUrls(): Promise<Url[]> {
  const urls: Url[] = [];
  const counts = await Promise.all(cityGuides.map((cg) => liveCosyCountForCityName(cg.city)));
  cityGuides.forEach((cg, i) => {
    if (counts[i] >= 3) urls.push({ loc: `${SITE}/en/guides/${cg.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.7 });
  });
  for (const g of guides) urls.push({ loc: `${SITE}/en/guides/${g.slug}`, lastmod: nowIso(), changefreq: "monthly", priority: 0.5 });
  return urls;
}

// ——— Blog (only publicly-released posts per the /growth schedule) ———
export async function blogUrls(): Promise<Url[]> {
  const posts = await getVisibleBlogPosts(true); // fail-closed: never leak drafts into the sitemap
  return posts.map((p) => ({ loc: `${SITE}/en/blog/${p.slug}`, lastmod: nowIso(), changefreq: "monthly", priority: 0.6 }));
}

// ——— Hotel detail pages (only surfaced hotels: cosy score ≥ 5 = the page's index gate) ———
export async function hotelUrls(): Promise<Url[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const out: Url[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    // The hotel page's index gate is `(score_final ?? score) >= 5`, so match it EXACTLY: fetch rows
    // where either clears 5, then keep only those whose effective score does — the sitemap and the
    // page's index/noindex decision can never drift apart around the 5.0 boundary.
    const { data, error } = await db
      .from("cosy_scores")
      .select("score, score_final, hotel:hotel_id (slug, updated_at)")
      .or("score.gte.5,score_final.gte.5")
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as unknown as Array<{ score: number | null; score_final: number | null; hotel: { slug: string | null; updated_at: string | null } | null }>) {
      const eff = row.score_final ?? row.score ?? null;
      if (eff == null || eff < 5) continue;
      const slug = (row.hotel?.slug || "").trim();
      if (!slug) continue;
      out.push({ loc: `${SITE}/en/hotels/${slug}`, lastmod: (row.hotel?.updated_at || nowIso()), changefreq: "weekly", priority: 0.6 });
    }
    if (data.length < pageSize) break;
  }
  return out;
}

// ——— Collection pages: /cosy-hotels/[concept]/[city] + theme hubs ———
// Membership follows the SAME Traveller Fit contract the pages render with (stored hotel_traveller_fit
// ≥ minConfidence ∪, for the legacy 5, the real-signal regex). We emit ONLY (concept, city) pairs
// clearing the concept's city min (legacy 5 → 2, new → 5) and only for KNOWN cities (cityFromSlug
// round-trips cleanly) — so we never put a URL in the sitemap the page then 404s. With
// hotel_traveller_fit empty this reduces to exactly the original facet emission for the legacy 5.
export async function collectionUrls(): Promise<Url[]> {
  const db = getServerSupabase();
  if (!db) return [];
  // Step 1: ONE scan of all surfaced hotels (score ≥ 5). Kept in memory so we never issue a per-city
  // query (that timed out over the ~hundreds of known cities). Collect KNOWN city slugs (round-trip
  // via cityFromSlug) + the set of live hotel ids (for the hub liveness gate).
  const rows: ScoreHotelRow[] = [];
  const citySlugs = new Set<string>();
  const liveIds = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await db
      .from("cosy_scores")
      .select(CITY_HOTEL_SELECT)
      .gte("score", 5)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as unknown as ScoreHotelRow[]) {
      rows.push(r);
      if (r.hotel_id) liveIds.add(String(r.hotel_id));
      const city = (r.hotel?.city || "").trim();
      if (city && cityFromSlug(`${cityBaseSlug(city)}-cosy-hotel`)) citySlugs.add(cityBaseSlug(city));
    }
    if (data.length < pageSize) break;
  }
  // Step 2: ONE bulk fetch of stored Traveller Fit assignments for the collection-enabled concepts
  // (empty when the table is empty ⇒ legacy-only membership below).
  const concepts = collectionConcepts();
  const assignments = await loadConceptAssignments(concepts.map((c) => c.slug));

  // Step 3: for each known city, compute members IN MEMORY via the shared contract (cityMembers →
  // conceptMembers), and emit a (concept, city) URL only where members clear the concept's city min.
  // CRITICAL: count over rpcCityUniverse (the page's top-80-by-score RPC window), not the full scan —
  // counting the full table emitted URLs (bathtub/venice) whose page, fed by the LIMIT 80 RPC, 404'd.
  const urls: Url[] = [];
  for (const citySlug of citySlugs) {
    const cityName = resolveCity(citySlug);
    const cityHotels = cityMembers(cityName, rpcCityUniverse(cityName, rows));
    for (const c of concepts) {
      if (conceptMembers(c, cityHotels, assignments).length >= cityCollectionMin(c)) {
        urls.push({ loc: `${SITE}/en/cosy-hotels/${c.slug}/${citySlug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
      }
    }
  }
  // Theme hubs: the legacy 5 unconditionally (each matches hundreds of hotels — as before). Other
  // concepts only when their LIVE membership clears the noindex gate — stored assignments, or, for
  // the rising-intent regex facets, live regex matches over the same scan (the hub page counts the
  // union, so clearing either floor means the hub renders ≥ the gate and is indexable). The
  // sitemap never lists a noindexed thin hub (and emits nothing new while the table is empty).
  const storedLive = new Map<string, number>();
  for (const [hid, m] of assignments) {
    if (!liveIds.has(hid)) continue;
    for (const [cid, conf] of m) {
      const cc = CONCEPT_BY_SLUG[cid];
      if (cc && conf >= cc.minConfidence) storedLive.set(cid, (storedLive.get(cid) || 0) + 1);
    }
  }
  for (const c of concepts) {
    const regexLive = !LEGACY_FACET_SLUGS.has(c.slug) && REGEX_FACET_SLUGS.has(c.slug)
      ? rows.filter((r) => c.re.test(`${(r.signals || []).join(" ")} ${r.description || ""}`)).length
      : 0;
    if (LEGACY_FACET_SLUGS.has(c.slug) || (storedLive.get(c.slug) || 0) >= THEME_HUB_INDEX_MIN || regexLive >= THEME_HUB_INDEX_MIN) {
      urls.push({ loc: `${SITE}/en/cosy-hotels/${c.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
    }
  }
  // Country hubs (only those clearing HUB_MIN, so the sitemap never lists a noindexed thin hub).
  for (const c of await loadCountryCounts()) {
    if (c.live >= HUB_MIN) urls.push({ loc: `${SITE}/en/cosy-hotels/in/${c.country.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
  }
  // Region (area) hubs — curated, all substantive (each clears HUB_MIN at authoring time).
  for (const r of REGIONS) {
    urls.push({ loc: `${SITE}/en/cosy-hotels/region/${r.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
  }
  return urls;
}

// ——— XML rendering ———
export function urlsetXml(urls: Url[]): string {
  const body = urls.map((u) =>
    `<url><loc>${esc(u.loc)}</loc>` +
    (u.lastmod ? `<lastmod>${esc(new Date(u.lastmod).toISOString())}</lastmod>` : "") +
    (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
    (u.priority != null ? `<priority>${u.priority}</priority>` : "") +
    `</url>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export function indexXml(children: string[]): string {
  const body = children.map((loc) => `<sitemap><loc>${esc(loc)}</loc><lastmod>${nowIso()}</lastmod></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>`;
}

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" };

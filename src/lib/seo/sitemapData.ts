// Shared data + XML helpers for the split sitemaps (WP1).
// Rules: only INDEXABLE, canonical /en URLs; never emit a URL that 404s or is noindexed.
// The hotel gate here (cosy_scores.score >= 5) is the SAME gate the hotel page uses to decide
// index vs noindex, so the sitemap and the pages can never disagree.
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { getServerSupabase } from "@/lib/supabase/server";
import { getVisibleBlogPosts } from "@/lib/blogSchedule";
import { FACETS, matchesFacet } from "@/lib/facets";
import { cityToSlug, cityFromSlug } from "@/lib/citySlug";
import { loadCountryCounts, HUB_MIN } from "@/lib/countryHub";

export const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
export type Url = { loc: string; lastmod?: string; changefreq?: string; priority?: number };
const nowIso = () => new Date().toISOString();
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] as string));

// ——— Static, evergreen pages (canonical /en) ———
export function staticUrls(): Url[] {
  const p = (path: string, priority = 0.6, changefreq = "monthly"): Url => ({ loc: `${SITE}${path}`, lastmod: nowIso(), changefreq, priority });
  return [
    { loc: `${SITE}/`, lastmod: nowIso(), changefreq: "weekly", priority: 1.0 },
    p("/en", 0.9, "weekly"),
    p("/en/cosiness-report", 0.9, "weekly"),
    p("/en/cosy-index", 0.8, "weekly"),
    p("/en/what-makes-a-hotel-cosy", 0.7),
    p("/en/cosy-score", 0.6),
    p("/en/collections", 0.6, "weekly"),
    p("/en/cosy-hotels", 0.7, "weekly"),
    p("/en/guides", 0.5),
    p("/en/for-hotels", 0.5),
    p("/en/make-your-hotel-look-cosy", 0.6),
    p("/en/blog", 0.6, "weekly"),
  ];
}

// ——— City / editorial guides (canonical /en only) ———
export function cityUrls(): Url[] {
  const urls: Url[] = [];
  for (const cg of cityGuides) urls.push({ loc: `${SITE}/en/guides/${cg.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.7 });
  for (const g of guides) urls.push({ loc: `${SITE}/en/guides/${g.slug}`, lastmod: nowIso(), changefreq: "monthly", priority: 0.5 });
  return urls;
}

// ——— Blog (only publicly-released posts per the /growth schedule) ———
export async function blogUrls(): Promise<Url[]> {
  const posts = await getVisibleBlogPosts();
  return posts.map((p) => ({ loc: `${SITE}/en/blog/${p.slug}`, lastmod: nowIso(), changefreq: "monthly", priority: 0.6 }));
}

// ——— Hotel detail pages (only surfaced hotels: cosy score ≥ 5 = the page's index gate) ———
export async function hotelUrls(): Promise<Url[]> {
  const db = getServerSupabase();
  if (!db) return [];
  const out: Url[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await db
      .from("cosy_scores")
      .select("score, hotel:hotel_id (slug, updated_at)")
      .gte("score", 5)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as unknown as Array<{ hotel: { slug: string | null; updated_at: string | null } | null }>) {
      const slug = (row.hotel?.slug || "").trim();
      if (!slug) continue;
      out.push({ loc: `${SITE}/en/hotels/${slug}`, lastmod: (row.hotel?.updated_at || nowIso()), changefreq: "weekly", priority: 0.6 });
    }
    if (data.length < pageSize) break;
  }
  return out;
}

// ——— Collection pages: /cosy-hotels/[facet]/[city] ———
// The facet page 404s below 2 matches, so we emit ONLY (facet, city) pairs with ≥2 hotels whose real
// cosy signals/description match the facet — and only for KNOWN cities (cityFromSlug round-trips
// cleanly), so we never put a 404 in the sitemap.
export async function collectionUrls(): Promise<Url[]> {
  const db = getServerSupabase();
  if (!db) return [];
  type Row = { signals: string[] | null; description: string | null; hotel: { city: string | null } | null };
  const byCitySlug = new Map<string, Row[]>();
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await db
      .from("cosy_scores")
      .select("signals, description, hotel:hotel_id (city)")
      .gte("score", 5)
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    for (const r of data as unknown as Row[]) {
      const city = (r.hotel?.city || "").trim();
      if (!city) continue;
      const base = cityToSlug(city).replace(/-cosy-hotel$/, "");
      if (!cityFromSlug(`${base}-cosy-hotel`)) continue; // known cities only → guaranteed round-trip
      (byCitySlug.get(base) || byCitySlug.set(base, []).get(base)!).push(r);
    }
    if (data.length < pageSize) break;
  }
  const urls: Url[] = [];
  for (const [citySlug, rows] of byCitySlug) {
    for (const f of FACETS) {
      const n = rows.filter((r) => matchesFacet(f, r.signals, r.description)).length;
      if (n >= 2) urls.push({ loc: `${SITE}/en/cosy-hotels/${f.slug}/${citySlug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
    }
  }
  // Theme hubs (one per facet, all substantive) + country hubs (only those clearing the index gate,
  // so the sitemap never lists a noindexed thin hub).
  for (const f of FACETS) urls.push({ loc: `${SITE}/en/cosy-hotels/${f.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
  for (const c of await loadCountryCounts()) {
    if (c.live >= HUB_MIN) urls.push({ loc: `${SITE}/en/cosy-hotels/in/${c.country.slug}`, lastmod: nowIso(), changefreq: "weekly", priority: 0.6 });
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

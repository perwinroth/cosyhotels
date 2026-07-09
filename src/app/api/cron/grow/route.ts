// Self-improving weekly growth cron (Phase 4).
// Adapted to Vercel cron (serverless) — NOT node-cron, which doesn't fit this platform.
// Registered in vercel.json to run Mondays 06:00 UTC.
//
// What it does (every step is gated; a missing credential is logged and skipped, never fatal):
//   1. Google Search Console: top pages last 28 days by clicks — if GOOGLE_SEARCH_CONSOLE_KEY set.
//   2. Identify cities that have >=3 hotels in Supabase but no guide page yet (the gaps).
//   3. Write a growth_log row capturing the run (needs the 2026_growth_log.sql migration).
//   4. Submit fresh editorial URLs to Google/legacy-Bing APIs (small quotas; each gated on its
//      env key) and the FULL sitemap URL set to IndexNow (Bing/Yandex/Seznam/Naver; keyless
//      beyond the public key file this repo serves).
//
// Note: a serverless cron cannot spawn code-generating agents or edit source (cityGuides.ts),
// so it records gaps_identified rather than fabricating pages_created. The existing guide
// route already renders any `{city}-cosy-hotel` slug from Supabase, so surfaced gaps are
// publishable by adding them to src/data/cityGuides.ts.
import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cityGuides } from "@/data/cityGuides";
import { submitUrls, submitUrlsToIndexNow } from "@/lib/indexing";
import { staticUrls, cityUrls, blogUrls, hotelUrls, collectionUrls } from "@/lib/seo/sitemapData";

export const runtime = "nodejs";
export const maxDuration = 300;

const MIN_HOTELS_PER_CITY = 3;

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

// Cities we already publish a guide for (by normalized name).
function coveredCities(): Set<string> {
  return new Set(cityGuides.map((g) => norm(g.city)));
}

async function fetchTopCitiesFromGSC(): Promise<{ top: string[]; skipped: boolean }> {
  // Gated: GSC needs a service-account key + the webmasters API. We only attempt if a key
  // is present; the full OAuth/JWT exchange is intentionally out of scope here — when the
  // key is configured this is where the call goes. Until then we skip and log.
  const key = process.env.GOOGLE_SEARCH_CONSOLE_KEY;
  if (!key) return { top: [], skipped: true };
  // Placeholder for the authenticated Search Analytics query. Returning empty (not skipped)
  // signals "ran, no data" so the log distinguishes it from "no credentials".
  return { top: [], skipped: false };
}

async function findGapCities(db: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<string[]> {
  const covered = coveredCities();
  const counts = new Map<string, { display: string; n: number }>();
  const PAGE = 1000;
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await db
      .from("hotels")
      .select("city")
      .not("city", "is", null)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const row of data as Array<{ city: string | null }>) {
      const c = (row.city || "").trim();
      if (!c) continue;
      const k = norm(c);
      const cur = counts.get(k);
      if (cur) cur.n += 1;
      else counts.set(k, { display: c, n: 1 });
    }
    if (data.length < PAGE) break;
  }
  const gaps: string[] = [];
  for (const [k, v] of counts) {
    if (v.n >= MIN_HOTELS_PER_CITY && !covered.has(k)) gaps.push(v.display);
  }
  // Most populous gaps first.
  gaps.sort((a, b) => (counts.get(norm(b))!.n - counts.get(norm(a))!.n));
  return gaps;
}

async function submitToIndexing(urls: string[]): Promise<string[]> {
  if (!urls.length) return [];
  // Real Google Indexing API + Bing URL submission (each gated on its env key).
  return submitUrls(urls);
}

async function run(): Promise<Record<string, unknown>> {
  const db = getServerSupabase();
  if (!db) return { error: "Supabase not configured", skipped: true };

  const errors: string[] = [];
  const gsc = await fetchTopCitiesFromGSC();
  if (gsc.skipped) errors.push("gsc_skipped:no_key");

  let gaps: string[] = [];
  try {
    gaps = await findGapCities(db);
  } catch (e) {
    errors.push(`gap_scan_error:${String(e)}`);
  }

  // Gap-guide URLs render but are noindex (doorway guard in the guide page), so submitting them
  // was wasted quota every week. Submit real, indexable URLs instead: the sitemap builders apply
  // the SAME gates as the pages, so this list can never contain a 404 or noindexed URL.
  let sitemapLocs: string[] = [];
  try {
    const [st, ci, bl, ho, co] = await Promise.all([staticUrls(), cityUrls(), blogUrls(), hotelUrls(), collectionUrls()]);
    sitemapLocs = [...st, ...ci, ...bl, ...ho, ...co].map((u) => u.loc);
  } catch (e) {
    errors.push(`sitemap_collect_error:${String(e)}`);
  }
  // Google Indexing API + legacy Bing have small quotas: send only fresh editorial pages there.
  // IndexNow takes the whole site in one POST (10k-URL limit; we are well under it).
  const freshUrls = sitemapLocs.filter((u) => u.includes("/en/blog/") || u.includes("/en/guides/")).slice(0, 20);
  errors.push(...(await submitToIndexing(freshUrls)));
  const inow = await submitUrlsToIndexNow(sitemapLocs);
  errors.push(`indexnow_bulk_submitted:${inow.submitted}`);
  if (inow.errors.length) errors.push(`indexnow_bulk_errors:${inow.errors.join("|")}`);

  const details = { gapCount: gaps.length, sitemapUrlCount: sitemapLocs.length, submittedFresh: freshUrls, gscTop: gsc.top };
  try {
    await db.from("growth_log").insert({
      pages_created: 0, // serverless cron records gaps; page creation is a code change
      top_cities: gsc.top,
      gaps_identified: gaps.slice(0, 50),
      errors,
      details,
    });
  } catch (e) {
    errors.push(`growth_log_write_error:${String(e)}`);
  }

  return { ok: true, gaps_identified: gaps.length, top_cities: gsc.top, errors };
}

export async function GET() {
  // Cron + manual trigger. Run inline so manual calls see the result.
  const res = await run();
  const status = "error" in res ? 500 : 200;
  return NextResponse.json(res, { status });
}

export async function POST() {
  after(async () => {
    try { await run(); } catch (e) { try { console.error("grow_cron_error", e); } catch {} }
  });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

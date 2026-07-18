// D-0010 "Feelings Layer" probe: read-only graph data for /api/graph/* and the MCP tools
// (src/lib/mcp/server.ts). NOT a new source of truth — every gate here is a thin wrapper over the
// SAME helpers every other public surface uses, so this can never drift from the site itself:
//   - public floor 5.0 (score_final ?? score) — the identical PUBLIC_GATE in blogPickScores.ts,
//     sitemapData.ts, and the hotel/guide pages (gotcosy-architecture-contract §2).
//   - delisted takedowns — src/lib/delisted.ts getDelistedSlugSet / isDelisted.
//   - verified booking posture — src/lib/ctaPolicy.ts resolveBookingCta + getStay22WrongSlugs
//     (the founder's verdict-gated Stay22-vs-website rule, unchanged).
//   - display city/country — src/lib/placeText.ts.
// No new tables, no writes, read-only. Pattern split: pure functions (mapGraphHotelRow,
// buildGraphHotelsResult, buildGraphHotelDetail) are unit-tested directly with plain objects,
// mirroring src/lib/seo/cityHotels.ts's cityMembers / src/lib/blogPickScores.ts's applyLiveScores.
// The async DB-touching wrappers (listGraphHotels, getGraphHotel) call getServerSupabase()
// themselves, same convention as loadCityCosyHotels/liveScoresBySlug, and are exercised by the
// route handlers + build, not mocked directly (no DB in this repo's test run — see MEASUREMENT.md).
import { getServerSupabase } from "@/lib/supabase/server";
import { getDelistedSlugSet, isDelisted, isRealHotelWebsite } from "@/lib/delisted";
import { resolveBookingCta, getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { displayCity, displayCountry } from "@/lib/placeText";
import { foldCity } from "@/lib/seo/cityHotels";
import { site } from "@/config/site";

/** The public gate every live-hotel surface shares (gotcosy-architecture-contract §2). */
export const PUBLIC_GATE = 5;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type GraphHotelSummary = {
  slug: string;
  name: string;
  city: string;
  country: string;
  cosy_score: number;
  url: string;
  /** "own_website" when the verdict-gated sweep has verified Stay22 wrong for this hotel AND it
   *  has a real, non-OTA site (ctaPolicy.ts resolveBookingCta); "stay22" otherwise (the default,
   *  unchanged posture for every hotel the sweep hasn't verified wrong). */
  verified_booking: "own_website" | "stay22";
  /** Present only when isRealHotelWebsite(website) — never an OTA/social/aggregator domain. */
  website?: string;
};

export type GraphHotelsResult = {
  hotels: GraphHotelSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type GraphHotelDetail = {
  slug: string;
  name: string;
  city: string;
  country: string;
  cosy_score: number;
  description: string | null;
  signals: string[];
  url: string;
  verified_booking: "own_website" | "stay22";
  website?: string;
};

/** Below-gate response shape — matches the site's own public posture (no score, no signals). */
export type GraphHotelBelowBar = {
  slug: string;
  below_bar: true;
  note: string;
  city: string;
  country: string;
  url: string;
};

export const BELOW_BAR_NOTE = "does not clear our cosiness bar";

/** Raw row shape from `cosy_scores` joined to `hotels` (mirrors CITY_HOTEL_SELECT in cityHotels.ts,
 *  minus the fields the graph API doesn't expose: lat/lng, hotel_id itself). */
export type GraphRawRow = {
  score: number | null;
  score_final: number | null;
  hotel: {
    slug: string | null;
    name: string | null;
    name_en?: string | null;
    city: string | null;
    country: string | null;
    website: string | null;
  } | null;
};

export const GRAPH_HOTEL_SELECT =
  "score, score_final, hotel:hotel_id!inner(slug, name, name_en, city, country, website)";

function hotelUrl(slug: string): string {
  return `${site.url}/en/hotels/${slug}`;
}

function bookingPosture(website: string | null, isVerifiedWrong: boolean): "own_website" | "stay22" {
  // stay22Href is irrelevant here (the graph API never returns a Stay22 link), so pass "" — only
  // .mode is read, and resolveBookingCta's website-vs-stay22 branch never touches the href param.
  return resolveBookingCta(website, "", isVerifiedWrong).mode === "website" ? "own_website" : "stay22";
}

/** One live-graph row → a summary entry, or null if it must be excluded (delisted, no slug/name,
 *  below the effective min score). Pure — no DB access. */
export function mapGraphHotelRow(
  row: GraphRawRow,
  opts: { delisted: Set<string>; wrongSlugs: Set<string>; minScore: number },
): GraphHotelSummary | null {
  const h = row.hotel;
  if (!h || !h.slug) return null;
  if (opts.delisted.has(h.slug)) return null;
  const eff = Number((row.score_final ?? row.score) ?? 0);
  if (!(eff >= opts.minScore)) return null;
  const name = String(h.name_en || h.name || "").trim();
  if (!name) return null;
  const entry: GraphHotelSummary = {
    slug: h.slug,
    name,
    city: displayCity(h.city, ""),
    country: displayCountry(h.country),
    cosy_score: Number(eff.toFixed(1)),
    url: hotelUrl(h.slug),
    verified_booking: bookingPosture(h.website, opts.wrongSlugs.has(h.slug)),
  };
  if (isRealHotelWebsite(h.website)) entry.website = String(h.website).trim();
  return entry;
}

export type BuildGraphHotelsParams = {
  city?: string;
  country?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
};

/** Filter + paginate a full set of raw live rows into the /api/graph/hotels shape. Pure — every
 *  gate (delisted, public floor, city/country match) reuses the same predicates the rest of the
 *  site uses, so this list can never show a hotel the site itself hides. Sorted by cosy_score
 *  desc, matching orderConceptMembers in cityHotels.ts. */
export function buildGraphHotelsResult(
  rows: GraphRawRow[],
  delisted: Set<string>,
  wrongSlugs: Set<string>,
  params: BuildGraphHotelsParams,
): GraphHotelsResult {
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.trunc(params.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const offset = Math.max(0, Math.trunc(params.offset ?? 0) || 0);
  const minScore = Math.max(PUBLIC_GATE, params.minScore ?? PUBLIC_GATE);
  const cityNeedle = params.city ? foldCity(params.city) : null;
  const countryNeedle = params.country ? foldCity(params.country) : null;

  const matched: GraphHotelSummary[] = [];
  for (const row of rows) {
    const entry = mapGraphHotelRow(row, { delisted, wrongSlugs, minScore });
    if (!entry) continue;
    if (cityNeedle && !foldCity(entry.city).includes(cityNeedle) && !foldCity(row.hotel?.city || "").includes(cityNeedle)) continue;
    if (countryNeedle && !foldCity(entry.country).includes(countryNeedle)) continue;
    matched.push(entry);
  }
  matched.sort((a, b) => b.cosy_score - a.cosy_score);
  const total = matched.length;
  const hotels = matched.slice(offset, offset + limit);
  return { hotels, total, limit, offset };
}

/** One hotel's detail response — full evidence when live and above the gate, an honest below-bar
 *  stub otherwise (no score exposed, matching the site's own public posture). Pure — no DB access.
 *  `score` is null when the hotel has no cosy_scores row at all (unrated). */
export function buildGraphHotelDetail(
  hotel: { slug: string; name: string | null; name_en?: string | null; city: string | null; country: string | null; website: string | null },
  score: { score: number | null; score_final: number | null; description: string | null; signals: string[] | null } | null,
  wrongSlugs: Set<string>,
): GraphHotelDetail | GraphHotelBelowBar {
  const city = displayCity(hotel.city, "");
  const country = displayCountry(hotel.country);
  const url = hotelUrl(hotel.slug);
  const eff = score ? Number((score.score_final ?? score.score) ?? 0) : null;
  if (eff == null || eff < PUBLIC_GATE) {
    return { slug: hotel.slug, below_bar: true, note: BELOW_BAR_NOTE, city, country, url };
  }
  const name = String(hotel.name_en || hotel.name || "").trim();
  const detail: GraphHotelDetail = {
    slug: hotel.slug,
    name,
    city,
    country,
    cosy_score: Number(eff.toFixed(1)),
    description: score?.description ?? null,
    signals: Array.isArray(score?.signals) ? (score!.signals as string[]) : [],
    url,
    verified_booking: bookingPosture(hotel.website, wrongSlugs.has(hotel.slug)),
  };
  if (isRealHotelWebsite(hotel.website)) detail.website = String(hotel.website).trim();
  return detail;
}

// ── DB-touching wrappers (used by the route handlers + MCP tools) ──────────────────────────────

/** Paged scan of every live (score ≥ 5) cosy_scores row, mirroring src/lib/seo/sitemapData.ts's
 *  hotelUrls()/cityHotels loops — same table, same OR-filter (a hotel can clear the gate via either
 *  raw `score` or an admin `score_final` override), same effective re-check downstream. Capped at
 *  60,000 rows like the existing scans. */
async function loadLiveGraphRows(db: NonNullable<ReturnType<typeof getServerSupabase>>): Promise<GraphRawRow[]> {
  const rows: GraphRawRow[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 60000; from += pageSize) {
    const { data, error } = await db
      .from("cosy_scores")
      .select(GRAPH_HOTEL_SELECT)
      .or("score.gte.5,score_final.gte.5")
      .range(from, from + pageSize - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as unknown as GraphRawRow[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

/** GET /api/graph/hotels and the find_cosy_hotels MCP tool both call this. Returns null only when
 *  Supabase is unavailable (route/tool turns that into a 503 / tool error), never on a DB query
 *  error mid-scan (loadLiveGraphRows just stops paging, same fail-open style as the sitemap scans). */
export async function listGraphHotels(params: BuildGraphHotelsParams): Promise<GraphHotelsResult | null> {
  const db = getServerSupabase();
  if (!db) return null;
  const [rows, delisted, wrongSlugs] = await Promise.all([
    loadLiveGraphRows(db),
    getDelistedSlugSet(db),
    getStay22WrongSlugs(db),
  ]);
  return buildGraphHotelsResult(rows, delisted, wrongSlugs, params);
}

/** GET /api/graph/hotel/[slug] and the get_hotel_feeling MCP tool both call this. Returns
 *  "not_found" for a missing OR delisted slug (delisted hotels 404, never a below-bar stub — a
 *  takedown must be indistinguishable from "never existed"). Returns null only when Supabase is
 *  unavailable. */
export async function getGraphHotel(slug: string): Promise<GraphHotelDetail | GraphHotelBelowBar | "not_found" | null> {
  const s = String(slug || "").trim();
  if (!s) return "not_found";
  const db = getServerSupabase();
  if (!db) return null;
  if (await isDelisted(s, db)) return "not_found";
  const { data: h, error: hErr } = await db
    .from("hotels")
    .select("id, slug, name, name_en, city, country, website")
    .eq("slug", s)
    .maybeSingle();
  if (hErr || !h) return "not_found";
  const hotel = h as unknown as { id: string; slug: string; name: string | null; name_en?: string | null; city: string | null; country: string | null; website: string | null };
  const { data: sc } = await db
    .from("cosy_scores")
    .select("score, score_final, description, signals")
    .eq("hotel_id", hotel.id)
    .maybeSingle();
  const wrongSlugs = await getStay22WrongSlugs(db);
  return buildGraphHotelDetail(
    hotel,
    (sc as { score: number | null; score_final: number | null; description: string | null; signals: string[] | null } | null) ?? null,
    wrongSlugs,
  );
}

// Hotel takedown mechanism (trust fix, 2026-07-16). Two layers, belt and braces:
//   1. DELISTED_SLUGS — a code-level Set, live the instant this deploys, no DB migration needed.
//   2. hotels.delisted_at — a DB column (sql/hotel-delist.sql, founder-run separately) checked
//      defensively: if the column does not exist yet, isDelisted() catches the error and falls
//      back to the Set alone, so this file works identically before and after the migration lands.
//
// Origin: brae-lodge (a real, small direct-booking guest house) asked for takedown because the
// Stay22 "roam" booking link on our hotel page matches the NEAREST OTA-bookable property, which for
// small direct-booking hotels can land on a DIFFERENT hotel entirely. Founder promised 24h takedown.
import type { SupabaseClient } from "@supabase/supabase-js";

// 2026-07-18 Stay22 likely-closed batch: 52 hotels whose Stay22 booking-widget landing page
// showed a closed/unavailable signal (closed_msg param, or the "0 properties available" /
// dest_id-search equivalent) on TWO SEPARATE independent visits (die-validation
// data/stay22-verdicts.json, full notes and slug list in data/likely-closed.json). Two-visit
// reproduction is the founder-set bar for "likely closed" vs a one-off widget glitch. Reversible
// filtering, not deletion — truth data (cosy_scores, hotels rows) is untouched; removing a slug
// from this Set (or clearing hotels.delisted_at) fully relists a hotel.
const LIKELY_CLOSED_2026_07_18 = [
  "siri-guesthouse",
  "sonne-st-moritz",
  "salute-hotel-villa",
  "pa-18901-the-doylestown-inn",
  "bella-noche",
  "kokkelikoo",
  "oba-hotel",
  "jim-s-guesthouse",
  "eb-vloed",
  "hotel-aziyade",
  "alte-dorfaue",
  "abercorn-guest-house",
  "kleines-gastehaus-gro",
  "hotel-villa-am-schlosspark",
  "la-maison-munich",
  "the5rooms",
  "brindleys",
  "st-paul-s-lodge",
  "b-b-a-casa-di-virgilio",
  "adare-house",
  "agriturismo-fienile-del-canalone",
  "ratanga-lodge-guest-house",
  "verona-lodge",
  "urban-hideaway",
  "mountain-home-b-b",
  "nha-sanho-ven-song",
  "coconut-garden",
  "villa-acacia",
  "fort-aan-de-klop",
  "gastehaus-heidi-wei",
  "pension-diana",
  "strathblane-country-house",
  "redclyffe-house",
  "gelynis-farm-guest-house",
  "pension-nadal",
  "casa-mathilde-sintra",
  "antica-fattoria-b-b-la-verdina",
  "guesthouse-castello-di-brusata",
  "casa-del-1577",
  "hotel-villa-igiea",
  "hotel-le-prieure",
  "sternen-gernsbach",
  "biodelfico",
  "pada-lagos",
  "ny-10027-the-international-cozy-inn",
  "locanda-al-colle",
  "b-b-la-quiete",
  "luxury-suite-in-villa-with-private-pool-near-rome-and-ostia",
  "residenza-carracci",
  "bali-yoga",
  "villa-maria",
  "residencia-alvaro",
];

export const DELISTED_SLUGS = new Set<string>(["brae-lodge", ...LIKELY_CLOSED_2026_07_18]);

// Minimal shape we need from the Supabase client — accepts the real client or a test double.
type DbLike = Pick<SupabaseClient, "from">;

/**
 * True if `slug` must never be rendered/linked/emitted anywhere (page, sitemap, outreach).
 * Checks the code-level Set first (works with no DB access at all), then defensively checks the
 * `hotels.delisted_at` column when a db client is provided — if that column doesn't exist yet
 * (pre-migration) or the query otherwise errors, this falls back to the Set-only result rather
 * than throwing, so callers never need their own try/catch.
 */
export async function isDelisted(slug: string, db?: DbLike | null): Promise<boolean> {
  const s = String(slug || "").trim();
  if (!s) return false;
  if (DELISTED_SLUGS.has(s)) return true;
  if (!db) return false;
  try {
    const { data, error } = await db
      .from("hotels")
      .select("delisted_at")
      .eq("slug", s)
      .maybeSingle();
    if (error) return false; // column may not exist yet (pre-migration) — Set-only result stands
    return !!(data as { delisted_at?: string | null } | null)?.delisted_at;
  } catch {
    return false;
  }
}

// ——— "Visit hotel website" CTA: sanitize the stored hotel.website before ever rendering it ———
// Only http(s) URLs with a dot in the host are safe to render as an outbound link (rejects empty
// strings, javascript:/data: schemes, bare words, and non-web schemes like ftp:).
export function isValidWebsiteUrl(website: string | null | undefined): boolean {
  const url = String(website || "").trim();
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return parsed.hostname.includes(".");
}

// ── CTA policy support (founder FINAL rule, 2026-07-16): verdict-gated CTA swap ─────────────────
// A real-browser sweep of Stay22's "Check availability" link (data/stay22-verdicts.json in the
// die-validation repo) is classifying each hotel's landing page. The founder's rule (see
// src/lib/ctaPolicy.ts resolveBookingCta for the full decision) is: Stay22 stays the default
// primary CTA everywhere, unchanged, UNLESS a hotel has been actually VERIFIED WRONG by the sweep
// (WRONG_PROPERTY / CITY_SEARCH / UNMATCHED_SEARCH) — only then does its own real website replace
// Stay22, or (if it has no real website) does Stay22 get relabelled "Check nearby stays". isRealHotelWebsite
// below is the "real, non-OTA site" test both branches share. "Real" excludes OTA/social/aggregator
// domains — those are not the hotel's own site even when a scrape stored one as `website`.
const OTA_EXACT_HOST_SUFFIXES = ["booking.com", "facebook.com", "instagram.com", "hotels.com"];
const OTA_WILDCARD_TLD_LABELS = new Set(["tripadvisor", "google", "expedia", "airbnb"]);

/**
 * True when `url` passes isValidWebsiteUrl AND its hostname is not an OTA/social/aggregator domain
 * (booking.com, facebook.com, instagram.com, hotels.com — any subdomain too; tripadvisor.*,
 * google.*, expedia.*, airbnb.* — any TLD). Only a URL that passes this is safe to present as the
 * hotel's OWN website and to replace the Stay22 CTA with entirely.
 */
export function isRealHotelWebsite(url: string | null | undefined): boolean {
  if (!isValidWebsiteUrl(url)) return false;
  let host: string;
  try {
    host = new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (OTA_EXACT_HOST_SUFFIXES.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  const labels = host.split(".");
  if (labels.some((l) => OTA_WILDCARD_TLD_LABELS.has(l))) return false;
  return true;
}

// ── List-surface exclusion ────────────────────────────────────────────────────────────────────────
// The detail page, sitemaps and outreach check per-slug; LISTING surfaces (city guides, facet/city,
// country hubs, regions, search, boards, collections, blog picks) render arrays and need a set. The
// DB-backed set is cached ~10 min per server process; the static DELISTED_SLUGS above always applies
// (so a code-level takedown works even before sql/hotel-delist.sql runs, and if the DB is down).
let dbDelistedCache: { at: number; slugs: Set<string> } = { at: 0, slugs: new Set() };
const DELIST_CACHE_MS = 10 * 60 * 1000;

/** Merged static + DB delisted slugs. Refreshes the DB part at most every 10 minutes; fail-open to
 *  the static set (a takedown must never break a page render). Also warms the sync check below. */
export async function getDelistedSlugSet(db?: DbLike | null): Promise<Set<string>> {
  const now = Date.now();
  if (db && now - dbDelistedCache.at > DELIST_CACHE_MS) {
    try {
      const { data } = await db.from("hotels").select("slug").not("delisted_at", "is", null);
      dbDelistedCache = { at: now, slugs: new Set(((data || []) as Array<{ slug: string | null }>).map((r) => r.slug || "").filter(Boolean)) };
    } catch {
      dbDelistedCache = { at: now, slugs: dbDelistedCache.slugs }; // keep last known, retry after TTL
    }
  }
  const merged = new Set(DELISTED_SLUGS);
  for (const s of dbDelistedCache.slugs) merged.add(s);
  return merged;
}

/** Sync check for hot loops (uses the static set + whatever the cache last saw). Callers on async
 *  paths should await getDelistedSlugSet first so the cache is warm. */
export function isDelistedSync(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return DELISTED_SLUGS.has(slug) || dbDelistedCache.slugs.has(slug);
}

// CANONICAL HOTEL IDENTITY — the single source of truth for "is this the same hotel?".
//
// Identity is GEOGRAPHIC first: two rows are the same physical hotel when they sit at the same
// coordinates (within ~80m) and their names are compatible. The old name|city string key was
// blind to geography, so the SAME building ingested from two sources (OSM + Google Places) got
// two different keys and slipped through — which is why duplicates like "MJs"/"MJ's" existed and
// why every surface grew its own render-time dedup hack. This module ends that: every ingest path
// resolves against it, the one-time merge clusters by it, and a guard test enforces it.
//
// Used by: ingest (resolveExisting), the dedup merge (sameHotel), and the no-dupes guard test.
import type { SupabaseClient } from "@supabase/supabase-js";

export function normName(s?: string | null): string {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

// Generic hotel words carry no identity — strip them before comparing significant tokens.
const GENERIC = new Set(["hotel", "the", "hotell", "inn", "by", "of", "part", "and", "hostel", "guesthouse", "guest", "house", "resort", "spa", "boutique", "a"]);
export function sigTokens(name?: string | null): Set<string> {
  return new Set(normName(name).split(/\s+/).filter((t) => t && !GENERIC.has(t)));
}
function spaceless(name?: string | null): string { return normName(name).replace(/\s+/g, ""); }

// Name compatibility, with a confidence flag:
//  - spaceless equality ("MJs"=="MJ's")                      → strong
//  - spaceless substring ("berns" ⊆ "bernshotel")            → strong if lengths are close
//  - significant-token Jaccard ≥ 0.5 ("elite plaza" vs       → strong at ≥ 0.7
//    "elite hotel plaza")
export function namesMatch(a?: string | null, b?: string | null): { match: boolean; strong: boolean } {
  const sa = spaceless(a), sb = spaceless(b);
  if (sa && sb && sa === sb) return { match: true, strong: true };
  if (sa && sb && (sa.includes(sb) || sb.includes(sa))) {
    const ratio = Math.min(sa.length, sb.length) / Math.max(sa.length, sb.length);
    return { match: true, strong: ratio >= 0.6 };
  }
  const ta = sigTokens(a), tb = sigTokens(b);
  if (!ta.size || !tb.size) return { match: false, strong: false };
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++;
  const j = inter / (ta.size + tb.size - inter);
  return { match: j >= 0.5, strong: j >= 0.7 };
}

// Haversine distance in metres.
export function distMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const SAME_RADIUS_M = 80;

// Aggregator/chain domains are shared by MANY different hotels, so they carry no identity — only a
// hotel's own site proves "same listing".
const AGGREGATOR_DOMAINS = new Set(["booking.com", "hilton.com", "marriott.com", "airbnb.com", "expedia.com", "hotels.com", "ihg.com", "accor.com", "hostelworld.com", "agoda.com", "tripadvisor.com", "google.com"]);

// A hotel's listing = its registrable domain PLUS the per-hotel path slug. Group operators run many
// hotels on ONE domain with different paths (keahotels.is/apotek-hotel vs keahotels.is/hotels/hotel-borg),
// so domain alone would wrongly merge sister hotels — the path slug is what tells them apart.
export function siteListing(url?: string | null): { domain: string; slug: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : "https://" + url);
    const domain = u.hostname.toLowerCase().replace(/^(www|www2|booking|book|secure|reservations?|res)\./, "");
    if (!domain) return null;
    // last meaningful path segment, ignoring locale/section prefixes and index files
    const segs = u.pathname.toLowerCase().split("/").map((s) => s.trim()).filter(Boolean)
      .filter((s) => !/^(en|de|fr|es|it|nl|sv|no|da|is|en-gb|en-us|hotel|hotels|index\.html?|home)$/.test(s));
    const slug = segs.length ? segs[segs.length - 1].replace(/\.html?$/, "") : "";
    return { domain, slug };
  } catch { return null; }
}

type HotelLike = { name?: string | null; lat?: number | null; lng?: number | null; website?: string | null };

// Are two rows the same physical hotel? `strong` = high confidence (auto-merge); a non-strong match
// is "borderline" (human review). THE WEBSITE IS AUTHORITATIVE: two rows on the same own-domain are
// the same listing → merge; two rows on DIFFERENT own-domains are different hotels → never merge
// (this overrides geo+name, which can be fooled by adjacent same-brand hotels). The website only
// decides when BOTH sides have a real, non-aggregator domain; otherwise fall back to geo + name.
export function sameHotel(a: HotelLike, b: HotelLike): { same: boolean; strong: boolean; dist: number } {
  const hasCoords = a.lat != null && a.lng != null && b.lat != null && b.lng != null;
  const d = hasCoords ? distMeters(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng)) : Infinity;

  // WEBSITE RULE (authoritative when both sides have a real, non-aggregator site).
  const la = siteListing(a.website), lb = siteListing(b.website);
  const realA = la && !AGGREGATOR_DOMAINS.has(la.domain), realB = lb && !AGGREGATOR_DOMAINS.has(lb.domain);
  if (realA && realB) {
    if (la!.domain !== lb!.domain) return { same: false, strong: false, dist: d }; // different sites → different hotels
    const within = !hasCoords || d <= 250;
    if (la!.slug && lb!.slug) {
      // Both have a per-hotel path slug — on a group domain the slug is what separates sister hotels.
      // Same slug = the same listing = same hotel (strong, per the website rule), name variants OK.
      return { same: la!.slug === lb!.slug && within, strong: la!.slug === lb!.slug && within, dist: d };
    }
    // Same domain, at least one bare root. A root domain belongs to ONE hotel, so same root = same
    // hotel (strong) UNLESS the names are clearly unrelated — that flags a group operator whose site
    // is the bare domain (Apótek vs Borg). namesMatch is lenient, so "Berns"/"Berns Hotel" still merge.
    const nm = namesMatch(a.name, b.name);
    return { same: nm.match && within, strong: nm.match && within, dist: d };
  }

  // No decisive website → geography + name.
  if (!hasCoords || d > SAME_RADIUS_M) return { same: false, strong: false, dist: d };
  const nm = namesMatch(a.name, b.name);
  if (!nm.match) return { same: false, strong: false, dist: d };
  // Strong only when the name is strong AND the points are very close (≤40m). Same-named rows
  // 40–80m apart, or partial-name rows, are borderline.
  return { same: true, strong: nm.strong && d <= 40, dist: d };
}

// Coarse geo+name key for a DB backstop unique index (~78m cells). Not the primary gate — a race
// could still place two rows in adjacent cells — but it cheaply blocks the obvious double-insert.
export function geoNameKey(name?: string | null, lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "";
  const tok = [...sigTokens(name)][0] || normName(name) || "x";
  const cellLat = Math.round(Number(lat) / 0.0007);
  const cellLng = Math.round(Number(lng) / (0.0007 / Math.max(0.2, Math.cos(Number(lat) * Math.PI / 180))));
  return `${tok}@${cellLat}.${cellLng}`;
}

// INGEST GATE: resolve an incoming hotel against the catalogue. Returns the canonical existing row
// (so the caller enriches it instead of inserting a duplicate) or null (genuinely new → insert).
export async function resolveExisting(
  db: SupabaseClient,
  h: HotelLike,
): Promise<{ id: string; name: string } | null> {
  if (h.lat == null || h.lng == null) return null;
  const dLat = 0.0008, dLng = 0.0008 / Math.max(0.2, Math.cos(Number(h.lat) * Math.PI / 180));
  const { data } = await db
    .from("hotels")
    .select("id,name,lat,lng")
    .gte("lat", Number(h.lat) - dLat).lte("lat", Number(h.lat) + dLat)
    .gte("lng", Number(h.lng) - dLng).lte("lng", Number(h.lng) + dLng)
    .limit(50);
  for (const cand of (data || []) as Array<{ id: string; name: string; lat: number; lng: number }>) {
    if (sameHotel(h, cand).same) return { id: String(cand.id), name: cand.name };
  }
  return null;
}

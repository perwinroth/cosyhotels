// Trip-board PURE logic: control exclusion, city-alias resolution, live-pick gating and the
// noindex rule. Deliberately free of any server/Supabase import so the node test runner can load
// it without env or a DB (mirrors travellerFit.ts using the RELATIVE controlMarkets import — the
// @/ alias does not resolve under the tsx test runner).
import { isFacetMintControlCity } from "./controlMarkets";
import type { TripBoard, TripStop } from "../data/tripBoards";
import { PUBLIC_GATE } from "./scoring/cosy";

/** The public gate: a hotel below 5.0 is never surfaced (same gate as blog picks + sitemaps).
 *  Re-exported from the single canonical source (src/lib/scoring/cosy.ts, which has zero imports
 *  and stays safe to load in this DB-free test-runner module) so every consumer of PUBLIC_GATE
 *  from "@/lib/trips" keeps working unchanged. */
export { PUBLIC_GATE };
/** A stop must resolve at least this many live picks or the whole board noindexes itself. */
export const MIN_PICKS_PER_STOP = 2;
/** Show at most this many picks per stop. */
export const MAX_PICKS_PER_STOP = 3;

/** A minimal pick shape (subset of CityCosyHotel) — the only fields the board render needs. */
export interface StopPick {
  slug: string;
  name: string;
  city: string;
  country: string;
  score: number;
}

/** Every city string a stop could be stored under: its display name plus its aliases. */
export function stopCities(stop: TripStop): string[] {
  return [stop.city, ...stop.cityAliases];
}

/**
 * TRUE when a stop touches an experiment control market (York / Savannah / Fez / Venice-historic).
 * EXACT-match only, never substring: reuses isFacetMintControlCity, so "New York" (normalises to
 * "new-york") can never match "york", and "Venice" is caught to protect the Venice-historic cluster.
 * Every alias is checked too, so a control name hiding in cityAliases is still caught.
 */
export function stopTouchesControl(stop: TripStop): boolean {
  return stopCities(stop).some((c) => isFacetMintControlCity(c));
}

/** TRUE when ANY stop of the board touches a control market — the board must not render or index. */
export function boardTouchesControl(board: TripBoard): boolean {
  return board.stops.some(stopTouchesControl);
}

/**
 * Gate + rank a pool of live hotels for one stop: drop anything below the public 5.0 gate, dedup by
 * slug, sort by live cosy score descending, and take at most MAX_PICKS_PER_STOP. Pure so the
 * live-score contract is unit-testable without a DB.
 */
export function gateAndRankPicks(pool: StopPick[]): StopPick[] {
  const seen = new Set<string>();
  const out: StopPick[] = [];
  for (const p of [...pool].sort((a, b) => b.score - a.score)) {
    if (p.score < PUBLIC_GATE) continue;
    if (seen.has(p.slug)) continue;
    seen.add(p.slug);
    out.push(p);
  }
  return out.slice(0, MAX_PICKS_PER_STOP);
}

/**
 * The board-level index decision from its resolved per-stop picks. A board is indexable only when it
 * touches NO control market AND every stop resolved at least MIN_PICKS_PER_STOP live picks. This is
 * the single predicate the page (noindex + render), generateMetadata and the sitemap all consult.
 */
export function boardIsIndexable(board: TripBoard, picksByStop: StopPick[][]): boolean {
  if (boardTouchesControl(board)) return false;
  if (picksByStop.length !== board.stops.length) return false;
  return picksByStop.every((picks) => picks.length >= MIN_PICKS_PER_STOP);
}

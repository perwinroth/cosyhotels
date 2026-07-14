// Trip-board LIVE resolution (server only). Fetches per-stop hotel picks from cosy_scores AT REQUEST
// TIME via the single source of truth loadCityCosyHotels (RPC, accent + exonym aware, already gated
// at the public 5.0 floor) — scores are NEVER stored on the board (lesson #44). Pure gating/ranking
// and the noindex rule live in ./trips so they stay unit-testable without a DB.
import { loadCityCosyHotels, cityBaseSlug } from "@/lib/seo/cityHotels";
import type { TripBoard, TripStop } from "@/data/tripBoards";
import { stopCities, gateAndRankPicks, boardIsIndexable, type StopPick } from "@/lib/trips";

/**
 * Live picks for one stop: fetch cosy hotels for the display city AND every alias (Bruges + Brugge,
 * Füssen + Fussen, Copenhagen + København), merge, then gate + rank. The union of the display name
 * and the aliases is what makes the lookup robust to whichever spelling the DB stored.
 */
export async function loadStopPicks(stop: TripStop): Promise<StopPick[]> {
  const bySlug = new Map<string, StopPick>();
  for (const cityName of stopCities(stop)) {
    const res = await loadCityCosyHotels(cityBaseSlug(cityName));
    if (!res) continue;
    for (const h of res.hotels) {
      if (bySlug.has(h.slug)) continue; // dedup across the primary + alias queries
      bySlug.set(h.slug, { slug: h.slug, name: h.name, city: h.city, country: h.country, score: h.score });
    }
  }
  return gateAndRankPicks([...bySlug.values()]);
}

export interface ResolvedBoard {
  board: TripBoard;
  stops: Array<{ stop: TripStop; picks: StopPick[] }>;
  indexable: boolean;
}

/** Resolve every stop's live picks and compute the board-level index decision (control + 2-pick rule). */
export async function resolveBoardLive(board: TripBoard): Promise<ResolvedBoard> {
  const stops = await Promise.all(
    board.stops.map(async (stop) => ({ stop, picks: await loadStopPicks(stop) })),
  );
  const indexable = boardIsIndexable(board, stops.map((s) => s.picks));
  return { board, stops, indexable };
}

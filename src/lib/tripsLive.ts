// Trip-board LIVE resolution (server only). Fetches per-stop hotel picks from cosy_scores AT REQUEST
// TIME via the single source of truth loadCityCosyHotels (RPC, accent + exonym aware, already gated
// at the public 5.0 floor) — scores are NEVER stored on the board (lesson #44). Pure gating/ranking
// and the noindex rule live in ./trips so they stay unit-testable without a DB.
// Also home to resolveSavedListPicks (saved lists v1) — the same live-resolution rule applied to an
// arbitrary set of hotel slugs a visitor picked, rather than a curated board's stops.
import { loadCityCosyHotels, cityBaseSlug } from "@/lib/seo/cityHotels";
import { getServerSupabase } from "@/lib/supabase/server";
import { displayCity, displayCountry } from "@/lib/placeText";
import type { TripBoard, TripStop } from "@/data/tripBoards";
import { stopCities, gateAndRankPicks, boardIsIndexable, PUBLIC_GATE, type StopPick } from "@/lib/trips";

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

/**
 * Live resolution for saved lists (v1): given a set of hotel slugs a visitor picked, look up their
 * CURRENT score at request time (never store a snapshot, same lesson #44 rule as the boards) and
 * drop anything that no longer clears the public 5.0 gate or no longer exists (renamed/removed
 * hotel). Order is preserved from the input `slugs` (the user's own list order). Batches the
 * lookup 100 at a time, same chunking as blogPickScores.ts's liveScoresBySlug.
 */
export async function resolveSavedListPicks(slugs: string[]): Promise<StopPick[]> {
  const db = getServerSupabase();
  if (!db || slugs.length === 0) return [];
  type Row = {
    slug: string;
    name: string | null;
    name_en: string | null;
    city: string | null;
    country: string | null;
    cosy_scores: { score: number | null; score_final: number | null } | Array<{ score: number | null; score_final: number | null }> | null;
  };
  const bySlug = new Map<string, StopPick>();
  for (let i = 0; i < slugs.length; i += 100) {
    const chunk = slugs.slice(i, i + 100);
    const { data, error } = await db
      .from("hotels")
      .select("slug,name,name_en,city,country,cosy_scores(score,score_final)")
      .in("slug", chunk);
    if (error || !data) continue;
    for (const row of data as unknown as Row[]) {
      const cs = Array.isArray(row.cosy_scores) ? row.cosy_scores[0] : row.cosy_scores;
      const score = cs ? (typeof cs.score_final === "number" ? cs.score_final : cs.score) : null;
      if (typeof score !== "number" || score < PUBLIC_GATE) continue;
      const name = String(row.name_en || row.name || row.slug).trim();
      bySlug.set(row.slug, { slug: row.slug, name, city: displayCity(row.city, ""), country: displayCountry(row.country), score });
    }
  }
  return slugs.map((s) => bySlug.get(s)).filter((p): p is StopPick => Boolean(p));
}

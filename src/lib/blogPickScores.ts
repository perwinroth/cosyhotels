// Live scores for blog picks — the number a reader sees must ALWAYS be the currently calculated
// cosy score, never a value frozen into blogPicks.json at generation time. Root cause (2026-07-09):
// picks generated 2026-06-30 carried then-true scores; the 2026-07-02 granular rescore compressed
// the scale (live ceiling ~7.6) and the stored numbers went stale on every live post (e.g. a hotel
// shown as 8.8 that actually scores 6.9). blogPicks.json remains the EDITORIAL source (which
// hotels, why-texts, images); the score column of record is cosy_scores, read at render time.
import { getServerSupabase } from "@/lib/supabase/server";
import { getDelistedSlugSet } from "@/lib/delisted";

/** Shape of one stored pick entry in blogPicks.json (the blog page's card model). */
export type PickEntry = { slug: string; name: string; city: string; country: string; score: number; why: string; img: string | null; cta: string };

/** The same public gate the sitemap + hotel pages use: below it a hotel is not surfaced. */
const PUBLIC_GATE = 5;

/** Pure merge: override each pick's score with the live value; drop picks whose hotel is missing
 *  or currently below the public gate (a sub-gate hotel must not be featured as a "cosiest" pick).
 *  Exported separately from the fetch so the policy is unit-testable. */
export function applyLiveScores(picks: PickEntry[], liveBySlug: Record<string, number | undefined>): PickEntry[] {
  const out: PickEntry[] = [];
  for (const p of picks) {
    const live = liveBySlug[p.slug];
    if (typeof live !== "number" || live < PUBLIC_GATE) continue;
    out.push({ ...p, score: Number(live.toFixed(1)) });
  }
  return out;
}

/** Fetch current scores for a set of hotel slugs. On ANY failure returns null — callers keep the
 *  stored scores rather than rendering an empty list (fail-open for availability, but the stored
 *  numbers are then at drift risk, so failures should stay rare/visible in logs). */
export async function liveScoresBySlug(slugs: string[]): Promise<Record<string, number | undefined> | null> {
  const db = getServerSupabase();
  if (!db || slugs.length === 0) return null;
  try {
    const bySlug: Record<string, number | undefined> = {};
    for (let i = 0; i < slugs.length; i += 100) {
      const { data, error } = await db
        .from("hotels")
        .select("slug, cosy_scores(score, score_final)")
        .in("slug", slugs.slice(i, i + 100));
      if (error) return null;
      for (const row of (data ?? []) as Array<{ slug: string; cosy_scores: { score: number | null; score_final: number | null } | Array<{ score: number | null; score_final: number | null }> | null }>) {
        const cs = Array.isArray(row.cosy_scores) ? row.cosy_scores[0] : row.cosy_scores;
        if (cs) bySlug[row.slug] = typeof cs.score_final === "number" ? cs.score_final : (cs.score ?? undefined);
      }
    }
    return bySlug;
  } catch {
    return null;
  }
}

/** Convenience: picks with live scores applied, or the stored picks untouched if the lookup failed. */
export async function picksWithLiveScores(picks: PickEntry[]): Promise<PickEntry[]> {
  const db = getServerSupabase();
  const delisted = await getDelistedSlugSet(db);
  const kept = picks.filter((p) => !delisted.has(p.slug)); // takedown excludes blog listicles too
  const live = await liveScoresBySlug(kept.map((p) => p.slug));
  return live ? applyLiveScores(kept, live) : kept;
}

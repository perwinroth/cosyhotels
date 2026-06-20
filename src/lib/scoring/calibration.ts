// The learning loop: turn human cosy labels (hotel_grades) into few-shot calibration
// anchors fed back into the Claude scorer. This is how the score learns YOUR taste without
// training weights — the labels steer the prompt. Cheap, reversible, and it gets better
// every time you grade.
//
// Retrieval is STRUCTURED SIMILARITY (same city / overlapping amenities / similar tier),
// not text embeddings — deterministic, free, no extra API dependency, and better at
// cold-start for this domain. For each hotel being scored we surface the labelled hotels
// most like it, plus a couple of strong global corrections. (Embedding-based nearest
// neighbour is a later option once labels number in the thousands.)
import type { SupabaseClient } from "@supabase/supabase-js";

export type GradedProfile = {
  name: string; city: string; country: string;
  amenities: string[]; stars: number | null;
  aiScore: number; humanScore: number | null;
  verdict: string; reasons: string[];
};

// Fetch every human-labelled hotel WITH the features we compare on — once per scoring batch.
export async function fetchGradedProfiles(db: SupabaseClient): Promise<GradedProfile[]> {
  const { data } = await db
    .from("hotel_grades")
    .select("cosy_verdict, human_score, reasons, ai_score, hotel:hotel_id!inner(name, name_en, city, country, amenities, stars)")
    .order("updated_at", { ascending: false })
    .limit(500);
  type Row = {
    cosy_verdict: string; human_score: number | null; reasons: string[] | null; ai_score: number | null;
    hotel: { name: string; name_en: string | null; city: string | null; country: string | null; amenities: string[] | null; stars: number | null } | null;
  };
  return ((data || []) as unknown as Row[])
    .filter((r) => r.hotel)
    .map((r) => ({
      name: String(r.hotel!.name_en || r.hotel!.name || "").trim(),
      city: String(r.hotel!.city || "").trim(),
      country: String(r.hotel!.country || "").trim(),
      amenities: (r.hotel!.amenities || []).map((a) => String(a).toLowerCase()),
      stars: r.hotel!.stars,
      aiScore: Number(r.ai_score ?? 0),
      humanScore: r.human_score != null ? Number(r.human_score) : null,
      verdict: r.cosy_verdict,
      reasons: r.reasons || [],
    }))
    .filter((p) => p.name);
}

export type ScoreTarget = { city?: string | null; country?: string | null; amenities?: string[] | null; stars?: number | null };

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a), B = new Set(b);
  let inter = 0; for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function similarity(t: ScoreTarget, p: GradedProfile): number {
  const tCity = String(t.city || "").trim().toLowerCase();
  const tCountry = String(t.country || "").trim().toLowerCase();
  let s = 0;
  if (tCity && tCity === p.city.toLowerCase()) s += 3;
  if (tCountry && tCountry === p.country.toLowerCase()) s += 1;
  s += jaccard((t.amenities || []).map((a) => String(a).toLowerCase()), p.amenities) * 2;
  if (t.stars != null && p.stars != null) s += Math.max(0, 1 - Math.abs(t.stars - p.stars) / 4);
  return s;
}

// Pick the calibration anchors for ONE hotel: its nearest labelled neighbours, plus the two
// strongest global disagreements (so site-wide corrections always apply even with no local match).
export function selectAnchorsFor(target: ScoreTarget, profiles: GradedProfile[], k = 12): GradedProfile[] {
  if (!profiles.length) return [];
  const ranked = profiles
    .map((p) => ({ p, sim: similarity(target, p) }))
    .sort((a, b) => b.sim - a.sim);
  const near = ranked.slice(0, k).map((r) => r.p);
  const picked = new Set(near);
  const globalDisagreements = profiles
    .filter((p) => p.verdict === "too_high" || p.verdict === "too_low")
    .slice(0, 2);
  for (const g of globalDisagreements) picked.add(g);
  return [...picked];
}

// Render anchors as a calibration block appended to the scoring input. Phrased as direct
// human feedback, with the corrected score and reasons when present so the model adjusts precisely.
export function formatCalibration(anchors: GradedProfile[]): string {
  if (!anchors.length) return "";
  const line = (a: GradedProfile): string => {
    const where = [a.city, a.country].filter(Boolean).join(", ");
    if (a.verdict === "good") return `- "${a.name}" (${where}) scored ${a.aiScore.toFixed(1)}/10 — a human agreed that was right.`;
    const dir = a.verdict === "too_high" ? "TOO HIGH" : a.verdict === "too_low" ? "TOO LOW" : "off";
    const corrected = a.humanScore != null ? ` a human would score it ${a.humanScore.toFixed(1)}/10` : ` a human felt it was ${dir.toLowerCase()}`;
    const why = a.reasons.length ? ` (${a.reasons.join(", ").replace(/_/g, " ")})` : "";
    return `- "${a.name}" (${where}) was scored ${a.aiScore.toFixed(1)}/10 but that is ${dir}:${corrected}${why}.`;
  };
  return [
    "\nHuman calibration — the site owner graded these similar hotels; weigh this taste and",
    "match their judgement when scoring this hotel:",
    ...anchors.map(line),
  ].join("\n");
}

// Convenience for callers that don't do per-hotel selection: most-recent disagreements + a few goods.
export async function fetchCalibrationAnchors(db: SupabaseClient, limit = 30): Promise<GradedProfile[]> {
  const profiles = await fetchGradedProfiles(db);
  const disagree = profiles.filter((p) => p.verdict !== "good" && p.verdict !== "unsure");
  const agree = profiles.filter((p) => p.verdict === "good");
  return [...disagree.slice(0, Math.ceil(limit * 0.7)), ...agree.slice(0, Math.floor(limit * 0.3))];
}

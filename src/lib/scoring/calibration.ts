// The learning loop: turn human cosy labels (hotel_grades) into few-shot calibration
// anchors fed back into the Claude scorer. This is how the score learns YOUR taste without
// training weights — the labels steer the prompt. Cheap, reversible, and it gets better
// every time you grade. (A trained/distilled model is a later step once labels number in
// the thousands; until then, few-shot anchoring beats a fine-tune.)
import type { SupabaseClient } from "@supabase/supabase-js";

export type CalibrationAnchor = { name: string; city: string; aiScore: number; verdict: string };

// Pull the human verdicts that most inform scoring: the DISAGREEMENTS (too_high / too_low)
// plus a few confirmed-good anchors. We bias toward disagreements because those are where
// the model's taste diverges from yours — the signal worth correcting.
export async function fetchCalibrationAnchors(db: SupabaseClient, limit = 30): Promise<CalibrationAnchor[]> {
  const { data } = await db
    .from("hotel_grades")
    .select("cosy_verdict, ai_score, hotel:hotel_id!inner(name, name_en, city)")
    .in("cosy_verdict", ["too_high", "too_low", "good"])
    .order("updated_at", { ascending: false })
    .limit(200);

  type Row = { cosy_verdict: string; ai_score: number | null; hotel: { name: string; name_en: string | null; city: string | null } | null };
  const rows = (data || []) as unknown as Row[];
  const disagree = rows.filter((r) => r.cosy_verdict !== "good");
  const agree = rows.filter((r) => r.cosy_verdict === "good");
  // Mostly disagreements (the corrective signal), a few confirmations (so it isn't all "lower it").
  const picked = [...disagree.slice(0, Math.ceil(limit * 0.7)), ...agree.slice(0, Math.floor(limit * 0.3))];
  return picked
    .filter((r) => r.hotel)
    .map((r) => ({
      name: String(r.hotel!.name_en || r.hotel!.name || "").trim(),
      city: String(r.hotel!.city || "").trim(),
      aiScore: Number(r.ai_score ?? 0),
      verdict: r.cosy_verdict,
    }))
    .filter((a) => a.name);
}

// Render anchors as a calibration block appended to the scoring input. Phrased as direct
// human feedback so the model adjusts toward it.
export function formatCalibration(anchors: CalibrationAnchor[]): string {
  if (!anchors.length) return "";
  const phrase: Record<string, string> = {
    too_high: "a human reviewer felt this was LESS cosy than the score — calibrate lower for similar hotels",
    too_low: "a human reviewer felt this was MORE cosy than the score — calibrate higher for similar hotels",
    good: "a human reviewer agreed the score was right",
  };
  const lines = anchors.map((a) => `- "${a.name}" (${a.city}) was scored ${a.aiScore.toFixed(1)}/10 — ${phrase[a.verdict] || "noted"}.`);
  return [
    "\nHuman calibration (the site owner graded these — weigh this taste when scoring):",
    ...lines,
  ].join("\n");
}

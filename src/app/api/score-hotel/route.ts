// Public "score my hotel" endpoint for the For-Hotels page. Runs the same Claude cosy
// scorer used everywhere else, returns the result, and best-effort stores the submission
// (feeds the future learning loop). NOTE: each call is a paid Claude request — basic input
// guards are here; a proper rate limit (e.g. Upstash/Vercel KV) is a recommended follow-up.
import { NextResponse } from "next/server";
import { claudeCosyScore } from "@/lib/scoring/claudeCosy";
import { getServerSupabase } from "@/lib/supabase/server";
import { fetchGradedProfiles, fetchPanelProfiles, selectAnchorsFor, formatCalibration } from "@/lib/scoring/calibration";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const name = str(body.name, 120);
  const city = str(body.city, 80);
  const country = str(body.country, 80);
  const website = str(body.website, 300);
  const description = str(body.description, 1200);
  const amenities = (Array.isArray(body.amenities) ? body.amenities.map((a) => String(a)) : str(body.amenities, 400).split(","))
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (name.length < 2 || (!city && !website && !description)) {
    return NextResponse.json({ error: "Please provide the hotel name and at least a city, website, or description." }, { status: 400 });
  }

  // Calibrate the public scorer to the SAME scale as the live dataset (founder-caught
  // 2026-07-09: an uncalibrated run handed a fictional guesthouse 8.2 while the live ceiling
  // is ~7.6 — a hotelier then finds no hotel on the site anywhere near their score). Two
  // parts, both derived from real data, best-effort (scoring proceeds uncalibrated on failure):
  // the human-grade anchors the recompute cron already uses, plus the live scale ceiling.
  let calibration: string | undefined;
  const dbForCal = getServerSupabase();
  if (dbForCal) {
    try {
      const [owner, panel, mx] = await Promise.all([
        fetchGradedProfiles(dbForCal),
        fetchPanelProfiles(dbForCal),
        dbForCal.from("cosy_scores").select("score_final").not("score_final", "is", null).order("score_final", { ascending: false }).limit(1),
      ]);
      const anchors = selectAnchorsFor({ city, country, amenities, stars: null }, [...owner, ...panel], 12);
      const ceiling = mx.data?.[0]?.score_final;
      calibration = [
        formatCalibration(anchors),
        typeof ceiling === "number"
          ? `\nScale context: across the ~17,700 hotels scored on this exact rubric, the current MAXIMUM score is ${Number(ceiling).toFixed(1)}/10. Scores above that ceiling should be practically unreachable for a self-described submission; a plausible small cosy place lands well below it.`
          : "",
      ].filter(Boolean).join("\n") || undefined;
    } catch {
      /* best-effort: uncalibrated scoring is better than no scoring */
    }
  }

  try {
    const r = await claudeCosyScore({ name, city, country, website, description, amenities, calibration });
    const db = getServerSupabase();
    if (db) {
      try {
        await db.from("hotel_submissions").insert({
          name, city, country, website, description, amenities,
          score_100: r.score100, score_10: r.score10,
          signals: r.signals, penalties: r.penalties,
          ai_description: r.description, confidence: r.confidence, model: r.model,
        });
      } catch {
        /* table may not exist yet; scoring still returns */
      }
    }
    return NextResponse.json({
      score10: r.score10,
      score100: r.score100,
      signals: r.signals,
      description: r.description,
      confidence: r.confidence,
    });
  } catch (e) {
    try { console.error("score_hotel_error", e); } catch {}
    return NextResponse.json({ error: "Scoring failed. Please try again." }, { status: 500 });
  }
}

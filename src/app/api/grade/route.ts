// Save one human cosy/link label (the ground-truth eval set). Upsert by hotel_id so the
// latest human verdict wins. Snapshots the AI score/confidence at grade time. Owner tool —
// noindexed page; optional GRADE_SECRET gate (if set) to stop drive-by writes.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VERDICTS = new Set(["good", "too_high", "too_low", "unsure"]);

export async function POST(req: Request) {
  const secret = process.env.GRADE_SECRET;
  if (secret) {
    const got = req.headers.get("x-grade-secret") || "";
    if (got !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const hotel_id = String(body.hotelId ?? body.hotel_id ?? "").trim();
  const cosy_verdict = String(body.cosy_verdict ?? "").trim();
  if (!hotel_id || !VERDICTS.has(cosy_verdict)) {
    return NextResponse.json({ error: "hotelId and a valid cosy_verdict are required" }, { status: 400 });
  }
  const link_ok = typeof body.link_ok === "boolean" ? body.link_ok : null;
  const note = body.note != null ? String(body.note).slice(0, 500) : null;
  const ai_score = body.ai_score != null ? Number(body.ai_score) : null;
  const ai_confidence = body.ai_confidence != null ? String(body.ai_confidence).slice(0, 10) : null;

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });

  const { error } = await db.from("hotel_grades").upsert(
    { hotel_id, cosy_verdict, link_ok, note, ai_score, ai_confidence, updated_at: new Date().toISOString() },
    { onConflict: "hotel_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

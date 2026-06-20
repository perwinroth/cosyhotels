// Save one friend cosiness vote (Tinder-style swipe). Upsert by (grader, hotel_id) so
// re-swiping updates. Public tool (link shared with friends); attributed by grader name.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const hotel_id = String(body.hotelId ?? body.hotel_id ?? "").trim();
  const grader = String(body.grader ?? "").trim().toLowerCase().slice(0, 40);
  const vote = body.vote;
  if (!hotel_id || !grader || typeof vote !== "boolean") {
    return NextResponse.json({ error: "hotelId, grader and vote (boolean) required" }, { status: 400 });
  }

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });

  const { error } = await db.from("cosy_votes").upsert(
    { hotel_id, grader, vote },
    { onConflict: "grader,hotel_id" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

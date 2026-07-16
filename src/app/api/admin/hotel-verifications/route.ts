import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Record a founder eyeball-verification decision (see /growth/verify). Auth: middleware gates
// /api/admin/* (panel cookie), same as every other growth-board write.
//
// decision:
//   "verified"   → founder_status = 'verified' (link confirmed correct; eligible for outreach)
//   "wrong_link" → founder_status = 'rejected' (link is wrong; do not contact off this row)
//   "delist"     → founder_status = 'rejected' AND hotels.delisted_at = now() (takedown mechanism,
//                  src/lib/delisted.ts: the hotel must never be rendered/linked/emitted anywhere)
export async function POST(req: Request) {
  const { hotel_id, decision } = await req.json().catch(() => ({}));
  const allowed = ["verified", "wrong_link", "delist"];
  if (!hotel_id || !allowed.includes(decision)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });

  const now = new Date().toISOString();
  const founder_status = decision === "verified" ? "verified" : "rejected";
  const { error } = await db
    .from("hotel_verifications")
    .update({ founder_status, founder_at: now, updated_at: now })
    .eq("hotel_id", String(hotel_id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (decision === "delist") {
    const { error: delistErr } = await db.from("hotels").update({ delisted_at: now }).eq("id", String(hotel_id));
    if (delistErr) return NextResponse.json({ error: delistErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, founder_status });
}

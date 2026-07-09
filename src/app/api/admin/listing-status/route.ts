import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Update a listing target's status (see /growth/listings). Auth: middleware gates /api/admin/*
// (panel cookie). Upsert because rows are created lazily on first status change; the target list
// itself lives in src/data/listingTargets.ts, not the DB.
export async function POST(req: Request) {
  const { id, status } = await req.json().catch(() => ({}));
  const allowed = ["queued", "submitted", "live", "skip"];
  if (!id || !allowed.includes(status)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });
  const { error } = await db.from("listing_status").upsert({ id: String(id), status, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

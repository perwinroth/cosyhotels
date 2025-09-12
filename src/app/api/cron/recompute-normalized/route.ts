import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export async function POST() {
  const supabase = getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  const db = supabase; // non-null thereafter

  // Count all
  const { count } = await db.from("cosy_scores").select("hotel_id", { count: "exact", head: true });
  const n = count || 0;
  if (n === 0) return NextResponse.json({ ok: true, updated: 0 });

  // Helper to fetch a single row at an offset (score asc)
  async function getAt(p: number) {
    const off = Math.max(0, Math.min(n - 1, Math.floor(p * (n - 1))));
    const { data, error } = await db.from("cosy_scores").select("raw_score").order("raw_score", { ascending: true }).range(off, off).limit(1);
    if (error || !data || !data.length) return null;
    const row = data[0] as { raw_score: number | null };
    return row.raw_score;
  }

  const p50 = (await getAt(0.5)) ?? 7.0;
  const p90 = (await getAt(0.9)) ?? Math.max(p50 + 0.1, 8.5);
  const p99 = (await getAt(0.99)) ?? Math.max(p90 + 0.1, 9.5);

  // Fetch all in chunks and update calibrated + public score
  const pageSize = 500;
  let updated = 0;
  for (let off = 0; off < n; off += pageSize) {
    const to = Math.min(n - 1, off + pageSize - 1);
    const { data, error } = await db.from("cosy_scores").select("hotel_id, raw_score").order("raw_score", { ascending: true }).range(off, to);
    if (error || !data) continue;
    const ups = (data as Array<{ hotel_id: string; raw_score: number | null }>).map(({ hotel_id, raw_score }) => {
      const raw = typeof raw_score === 'number' ? raw_score : 0;
      // Map so p90 -> 9.0, p99 -> 9.8, clamp 0..10
      let calibrated = raw;
      if (raw <= p90) {
        // Squeeze below p90 gently around 7
        const t = (raw - p50) / Math.max(0.0001, (p90 - p50));
        calibrated = 7.0 + t * 2.0; // p50->7, p90->9
      } else {
        const t = (raw - p90) / Math.max(0.0001, (p99 - p90));
        calibrated = 9.0 + t * 0.8; // p90->9, p99->9.8
      }
      calibrated = Math.max(0, Math.min(10, calibrated));
      return { hotel_id, calibrated_score: calibrated, score: calibrated } as { hotel_id: string; calibrated_score: number; score: number };
    });
    if (ups.length) {
      const { error: upErr } = await db.from("cosy_scores").upsert(ups, { onConflict: "hotel_id" });
      if (!upErr) updated += ups.length;
    }
  }

  return NextResponse.json({ ok: true, updated, p50, p90, p99 });
}

export async function GET() { return POST(); }

// Populate hotels.name_en for FEATURED hotels (score >= 5). Latin names are stored as-is (no
// API call); non-Latin names are romanized via Claude Haiku. Once set, non-Latin-named hotels
// can appear on the English site (display name_en) instead of being filtered out. Resumable.
//   GET /api/cron/transliterate-names?limit=100   (max 500), &dry=1
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { transliterateName } from "@/lib/transliterate";
import { isLatin } from "@/lib/placeText";

export const runtime = "nodejs";
export const maxDuration = 300;
export const revalidate = 0;

const CONC = 6;
type Row = { id: string; name: string | null };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(500, Math.max(1, Number(sp.get("limit")) || 100));
  const dry = sp.get("dry") === "1";

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

  // Featured hotels (score>=5) without a name_en yet.
  const q = () => db
    .from("hotels")
    .select("id,name,cosy_scores!inner(score)", dry ? { count: "exact", head: true } : {})
    .gte("cosy_scores.score", 5)
    .is("name_en", null);

  if (dry) {
    const { count } = await q();
    return NextResponse.json({ dry: true, remaining: count ?? 0 });
  }

  const { data, error } = await q().limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const r of (data || []) as unknown as Array<{ id: string; name: string | null }>) {
    if (!r.id || seen.has(r.id)) continue;
    seen.add(r.id);
    rows.push({ id: r.id, name: r.name });
  }
  if (!rows.length) return NextResponse.json({ processed: 0, done: true });

  let romanized = 0, latin = 0, calls = 0;
  for (let i = 0; i < rows.length; i += CONC) {
    await Promise.all(rows.slice(i, i + CONC).map(async (h) => {
      const name = (h.name || "").trim();
      if (!name) return;
      if (isLatin(name)) { // already English — mark done without an API call
        await db.from("hotels").update({ name_en: name }).eq("id", h.id);
        latin++;
        return;
      }
      try {
        const en = await transliterateName(name); calls++;
        if (en) { await db.from("hotels").update({ name_en: en }).eq("id", h.id); romanized++; }
      } catch { /* transient — leave null, retried next run */ }
    }));
  }

  return NextResponse.json({ processed: rows.length, romanized, latinKept: latin, claudeCalls: calls, done: rows.length < limit });
}

import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getImageForHotel } from "@/lib/hotelImages";

export const runtime = 'nodejs';
export const maxDuration = 120;

type EnsureFeaturedOk = { ensured: boolean; inserted?: number; have?: number };
type EnsureFeaturedErr = { error: string };
type EnsureFeaturedResult = EnsureFeaturedOk | EnsureFeaturedErr;

async function ensureFeatured(force = false): Promise<EnsureFeaturedResult> {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' };
  // Current rows
  const { data: cur } = await db.from('featured_top').select('position,hotel_id,image_url').order('position', { ascending: true }).limit(9);
  const have = (cur || []).length;
  if (have >= 9 && !force) {
    // Backfill missing images for existing featured rows
    const rows = (cur || []) as Array<{ position: number; hotel_id: string | null; image_url: string | null }>;
    let updated = 0;
    for (const r of rows) {
      if (r.image_url) continue;
      if (!r.hotel_id) continue;
      try {
        const { data: h } = await db
          .from('hotels')
          .select('name,city,slug')
          .eq('id', r.hotel_id)
          .maybeSingle();
        if (!h) continue;
        const url = await getImageForHotel(String(h.name), String(h.city || ''), String(h.slug), String(r.hotel_id));
        if (url) { await db.from('featured_top').update({ image_url: url }).eq('position', r.position); updated++; }
      } catch {}
    }
    return { ensured: false, have };
  }

  type Row = { score: number | null; score_final: number | null; hotel: { id: string; slug: string; name: string; city: string | null; country: string | null; rating: number | null; affiliate_url: string | null } | null };
  const { data: rows } = await db
    .from('cosy_scores')
    .select('score, score_final, hotel:hotel_id (id,slug,name,city,country,rating,affiliate_url)')
    .order('score_final', { ascending: false, nullsFirst: false })
    .order('score', { ascending: false })
    .limit(60);
  const list = ((rows || []) as unknown as Row[]).filter((r) => r.hotel);
  const seen = new Set<string>();
  const picks: Array<{ h: NonNullable<Row['hotel']>; s: number }> = [];
  for (const r of list) {
    const h = r.hotel!;
    if (!h.slug || seen.has(h.slug)) continue;
    seen.add(h.slug);
    const s = typeof r.score_final === 'number' ? Number(r.score_final) : (typeof r.score === 'number' ? Number(r.score) : 0);
    if (s < 7.0) continue; // enforce cosy >= 7 for front page
    picks.push({ h, s });
    if (picks.length >= 9) break;
  }
  if (!picks.length) return { ensured: false, have: 0 };

  type Insert = { position: number; hotel_id: string; score: number; image_url: string };
  const inserts: Insert[] = await Promise.all(picks.map(async ({ h, s }, i) => ({
    position: i + 1,
    hotel_id: h.id,
    score: s,
    image_url: await getImageForHotel(String(h.name), String(h.city || ''), String(h.slug), String(h.id)) || '/seal.svg',
  })));
  await db.from('featured_top').delete().neq('position', -1);
  if (inserts.length) await db.from('featured_top').insert(inserts);
  return { ensured: true, inserted: inserts.length };
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  after(async () => {
    try { await ensureFeatured(force); } catch (e) { try { console.error('ensure_featured_error', e); } catch {} }
  });
  return NextResponse.json({ scheduled: true }, { status: 202 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  const res: EnsureFeaturedResult = await ensureFeatured(force);
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}

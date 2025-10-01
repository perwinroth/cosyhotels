import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = 'nodejs';
export const maxDuration = 180;

async function run(limit = 100) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;
  const { data, error } = await db
    .from('hotels')
    .select('id,slug,name,website, hotel_images ( url )')
    .not('website', 'is', null)
    .limit(limit * 2);
  if (error || !data) return { processed: 0, updated: 0 } as const;
  let processed = 0, updated = 0;
  for (const r of data as Array<{ id: string; name: string; slug: string; website: string | null; hotel_images: Array<{ url: string | null }> }>) {
    if (processed >= limit) break;
    const has = Array.isArray(r.hotel_images) && r.hotel_images.some((x) => !!x?.url);
    if (has || !r.website) continue;
    processed++;
    try {
      const res = await fetch(r.website, { redirect: 'follow' });
      const html = await res.text();
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
      const url = m ? m[1] : null;
      if (url) { await db.from('hotel_images').insert({ hotel_id: r.id, url }); updated++; }
    } catch {}
  }
  return { processed, updated } as const;
}

export async function POST() { const res = await run(); if ('error' in res) return NextResponse.json(res, { status: 500 }); return NextResponse.json(res); }
export async function GET(req: Request) { const url = new URL(req.url); const limit = Number(url.searchParams.get('limit') || '100'); after(async () => { try { await run(limit); } catch (e) { try { console.error('fetch_og_images_error', e); } catch {} } }); return NextResponse.json({ scheduled: true, limit }, { status: 202 }); }


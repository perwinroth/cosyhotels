import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildAffiliateUrl, bookingSearchUrl, expediaSearchUrl, type Provider } from "@/lib/affiliates";

export const runtime = 'nodejs';
export const maxDuration = 120;

type HotelRow = { id: string; slug: string; name: string; city: string | null; country: string | null; affiliate_url: string | null };

function vendorUrl(vendor: 'booking' | 'expedia', h: HotelRow) {
  if (vendor === 'booking') return bookingSearchUrl({ name: h.name, city: h.city, country: h.country });
  return expediaSearchUrl({ name: h.name, city: h.city, country: h.country });
}

async function run(vendor: 'booking' | 'expedia', provider: Provider, overwrite = false) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;
  const sel = db.from('hotels').select('id,slug,name,city,country,affiliate_url').limit(2000);
  const { data } = overwrite ? await sel : await sel.is('affiliate_url', null);
  const rows = (data || []) as HotelRow[];
  let processed = 0, updated = 0;
  for (const h of rows) {
    processed++;
    const base = vendorUrl(vendor, h);
    if (!base) continue;
    const urlFinal = buildAffiliateUrl(base, { provider });
    const { error } = await db.from('hotels').update({ affiliate_url: urlFinal }).eq('id', h.id);
    if (!error) updated++;
  }
  return { vendor, provider, overwrite, processed, updated } as const;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const vendor = (url.searchParams.get('vendor') || 'booking').toLowerCase() as 'booking' | 'expedia';
  const provider = (url.searchParams.get('provider') || 'generic').toLowerCase() as Provider;
  const overwrite = (url.searchParams.get('overwrite') || 'false').toLowerCase() === 'true';
  const res = await run(vendor, provider, overwrite);
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendor = (url.searchParams.get('vendor') || 'booking').toLowerCase() as 'booking' | 'expedia';
  const provider = (url.searchParams.get('provider') || 'generic').toLowerCase() as Provider;
  const overwrite = (url.searchParams.get('overwrite') || 'false').toLowerCase() === 'true';
  after(async () => { try { await run(vendor, provider, overwrite); } catch (e) { try { console.error('backfill_affiliates_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true, vendor, provider, overwrite }, { status: 202 });
}

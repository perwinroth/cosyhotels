import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildAffiliateUrl, bookingSearchUrl, expediaSearchUrl, type Provider } from "@/lib/affiliates";

export const runtime = 'nodejs';
export const maxDuration = 120;

type HotelRow = { id: string; slug: string; name: string; city: string | null; country: string | null; affiliate_url: string | null };

function vendorUrl(vendor: 'booking' | 'expedia', h: HotelRow) {
  if (vendor === 'booking') return bookingSearchUrl({ name: h.name, city: h.city, country: h.country });
  return expediaSearchUrl({ name: h.name, city: h.city, country: h.country });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const vendor = (url.searchParams.get('vendor') || 'booking').toLowerCase() as 'booking' | 'expedia';
  const provider = (url.searchParams.get('provider') || 'generic').toLowerCase() as Provider;
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  const { data } = await db
    .from('hotels')
    .select('id,slug,name,city,country,affiliate_url')
    .is('affiliate_url', null)
    .limit(2000);
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
  return NextResponse.json({ vendor, provider, processed, updated });
}


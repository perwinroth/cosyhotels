import { NextResponse, after } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { bookingSearchHotels, bookingGetHotelDetails, type BookingHotelDetails, type BookingHotelSummary } from "@/lib/vendors/booking";
import { expediaSearchHotels, expediaGetHotelDetails, type ExpediaHotelDetails, type ExpediaHotelSummary } from "@/lib/vendors/expedia";
import { cosyScore } from "@/lib/scoring/cosy";
import { bookingSearchUrl, expediaSearchUrl, buildAffiliateUrl } from "@/lib/affiliates";

type Vendor = 'booking' | 'expedia';

type CombinedSummary = BookingHotelSummary | ExpediaHotelSummary;
type CombinedDetails = BookingHotelDetails | ExpediaHotelDetails | CombinedSummary;

function pickWebsite(x: CombinedDetails): string | null {
  return 'website' in x && typeof x.website === 'string' ? x.website : null;
}
function pickImages(x: CombinedDetails): string[] {
  if ('images' in x && Array.isArray((x as { images?: unknown }).images)) {
    return ((x as { images?: unknown }).images as unknown[])
      .map((u) => (typeof u === 'string' ? u : null))
      .filter((u): u is string => !!u);
  }
  return [];
}
function pickAmenities(x: CombinedDetails): string[] {
  if ('amenities' in x && Array.isArray((x as { amenities?: unknown }).amenities)) {
    return ((x as { amenities?: unknown }).amenities as unknown[])
      .map((a) => (typeof a === 'string' ? a : (typeof a === 'object' && a && 'name' in a && typeof (a as { name?: unknown }).name === 'string' ? String((a as { name?: unknown }).name) : null)))
      .filter((s): s is string => !!s);
  }
  return [];
}

async function run(vendor: Vendor, city: string, limit = 100) {
  const db = getServerSupabase();
  if (!db) return { error: 'Supabase not configured' } as const;

  // 1) Search vendor for a city
  const summaries: CombinedSummary[] = vendor === 'booking'
    ? await bookingSearchHotels(city)
    : await expediaSearchHotels(city);
  const list = summaries.slice(0, limit);

  let upserted = 0, updated = 0; const scanned = list.length;
  for (const s of list as CombinedSummary[]) {
    try {
      // 2) Fetch details to get images/amenities when available
      const d: CombinedDetails | null = vendor === 'booking'
        ? await bookingGetHotelDetails(s.id)
        : await expediaGetHotelDetails(s.id);
      const details = d || s;
      const name = details.name || s.name;
      const cityName = details.city || s.city || city;
      const country = details.country || s.country || null;
      const address = 'address' in details && typeof details.address === 'string' ? details.address : null;
      const lat = (typeof details.latitude === 'number' ? details.latitude : null);
      const lng = (typeof details.longitude === 'number' ? details.longitude : null);
      const rating10 = (typeof details.rating10 === 'number' ? details.rating10 : null);
      const reviewsCount = (typeof details.reviewsCount === 'number' ? details.reviewsCount : null);
      const am = pickAmenities(details)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => x.replace(/\bpet(s)?\b/i, 'Pet-friendly'));

      // 3) Build affiliate URL if empty
      const affiliate = vendor === 'booking'
        ? bookingSearchUrl({ name, city: cityName || null, country })
        : expediaSearchUrl({ name, city: cityName || null, country });
      const affiliateUrl = buildAffiliateUrl(affiliate);

      // 4) Upsert hotel
      const { data: row } = await db
        .from('hotels')
        .upsert({
          slug: `${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${String(cityName || '').toLowerCase().replace(/[^a-z0-9]+/g,'-')}`.replace(/-+/g,'-').replace(/^-|-$/g,''),
          name,
          address,
          city: cityName || null,
          country,
          lat,
          lng,
          rating: rating10 != null ? Number((rating10).toFixed(1)) : null,
          reviews_count: reviewsCount ?? null,
          amenities: am.length ? am : null,
          website: d ? pickWebsite(d) : null,
          affiliate_url: affiliateUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'slug' })
        .select('id')
        .single();
      if (!row?.id) continue;
      upserted++;

      // 5) Upsert cosy score (base only; normalizer/cron can refine later)
      const baseScore = cosyScore({ rating: rating10 ?? undefined, amenities: am, description: `${name}. ${cityName || ''}, ${country || ''}` });
      await db.from('cosy_scores').upsert({ hotel_id: row.id, score: baseScore, computed_at: new Date().toISOString() }, { onConflict: 'hotel_id' });

      // 6) Save first image
      const images = d ? pickImages(d) : [];
      const first = images.find((u) => /^https?:\/\//.test(u)) || null;
      if (first) {
        await db.from('hotel_images').insert({ hotel_id: row.id, url: first }).throwOnError();
        updated++;
      }
    } catch {}
  }
  return { vendor, city, scanned, upserted, updated } as const;
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const vendor = (url.searchParams.get('vendor') || 'booking').toLowerCase() as Vendor;
  const city = url.searchParams.get('city');
  const limit = Number(url.searchParams.get('limit') || '50');
  if (!city) return NextResponse.json({ error: 'Missing ?city' }, { status: 400 });
  const res = await run(vendor, city, limit);
  if ('error' in res) return NextResponse.json(res, { status: 500 });
  return NextResponse.json(res);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const vendor = (url.searchParams.get('vendor') || 'booking').toLowerCase() as Vendor;
  const city = url.searchParams.get('city');
  const limit = Number(url.searchParams.get('limit') || '50');
  if (!city) return NextResponse.json({ error: 'Missing ?city' }, { status: 400 });
  after(async () => { try { await run(vendor, city, limit); } catch (e) { try { console.error('backfill_vendors_error', e); } catch {} } });
  return NextResponse.json({ scheduled: true, vendor, city, limit }, { status: 202 });
}

export const runtime = 'nodejs';
export const maxDuration = 180;

// Booking.com connector (Content/Search via partner API)
// Notes: Requires partner credentials and agreed API access. This is a thin wrapper
// around the vendor endpoints; adjust BASE/headers to your account spec.

export type BookingHotelSummary = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating10?: number | null; // optional 10-scale
  reviewsCount?: number | null;
};

export type BookingHotelDetails = BookingHotelSummary & {
  website?: string | null;
  images?: string[];
  amenities?: string[];
};

function bookingHeaders() {
  const headers: Record<string, string> = { 'accept': 'application/json' };
  const key = process.env.BOOKING_API_KEY;
  const username = process.env.BOOKING_API_USERNAME;
  const password = process.env.BOOKING_API_PASSWORD;
  if (key) headers['x-api-key'] = key;
  if (username && password) {
    const basic = Buffer.from(`${username}:${password}`).toString('base64');
    headers['authorization'] = `Basic ${basic}`;
  }
  return headers;
}

export async function bookingSearchHotels(city: string): Promise<BookingHotelSummary[]> {
  const base = process.env.BOOKING_API_BASE || '';
  if (!base) return [];
  // Replace with your partner search endpoint and parameters
  const url = new URL('/v1/hotels/search', base);
  url.searchParams.set('city', city);
  const res = await fetch(url.toString(), { headers: bookingHeaders(), next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json: unknown = await res.json();
  const list = getArray(json, 'hotels');
  return list.map((h) => ({
    id: str(h, 'id') || str(h, 'hotel_id') || '',
    name: str(h, 'name') || str(h, 'title') || '',
    address: str(h, 'address'),
    city: str(h, 'city'),
    country: str(h, 'country'),
    latitude: num(h, 'latitude'),
    longitude: num(h, 'longitude'),
    rating10: num(h, 'review_score'),
    reviewsCount: num(h, 'review_count'),
  }));
}

export async function bookingGetHotelDetails(id: string): Promise<BookingHotelDetails | null> {
  const base = process.env.BOOKING_API_BASE || '';
  if (!base) return null;
  const url = new URL(`/v1/hotels/${encodeURIComponent(id)}`, base);
  const res = await fetch(url.toString(), { headers: bookingHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const h: unknown = await res.json();
  const images: string[] = getArray(h, 'images')
    .map((i) => (str(i, 'url') || str(i, 'src')))
    .filter((u): u is string => !!u);
  const amenities: string[] = getArray(h, 'amenities')
    .map((a) => (typeof a === 'string' ? a : (str(a, 'name') || null)))
    .filter((v): v is string => !!v);
  const out: BookingHotelDetails = {
    id: str(h, 'id') || '',
    name: str(h, 'name') || '',
    address: str(h, 'address'),
    city: str(h, 'city'),
    country: str(h, 'country'),
    latitude: num(h, 'latitude'),
    longitude: num(h, 'longitude'),
    rating10: num(h, 'review_score'),
    reviewsCount: num(h, 'review_count'),
    website: str(h, 'website'),
    images,
    amenities,
  };
  return out;
}

// helpers
function isObj(x: unknown): x is Record<string, unknown> { return typeof x === 'object' && x !== null; }
function getArray(obj: unknown, key: string): unknown[] { if (isObj(obj)) { const v = obj[key]; if (Array.isArray(v)) return v as unknown[]; } return []; }
function str(obj: unknown, key: string): string | null { if (!isObj(obj)) return null; const v = obj[key]; if (typeof v === 'string') return v; if (typeof v === 'number') return String(v); return null; }
function num(obj: unknown, key: string): number | null { if (!isObj(obj)) return null; const v = obj[key]; if (typeof v === 'number') return v; return null; }

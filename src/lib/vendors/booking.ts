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
  const json = await res.json();
  // Map vendor payload -> summary
  const arr: any[] = Array.isArray(json?.hotels) ? json.hotels : [];
  return arr.map((h) => ({
    id: String(h.id || h.hotel_id || ''),
    name: String(h.name || h.title || ''),
    address: h.address || null,
    city: h.city || null,
    country: h.country || null,
    latitude: (typeof h.latitude === 'number' ? h.latitude : null),
    longitude: (typeof h.longitude === 'number' ? h.longitude : null),
    rating10: (typeof h.review_score === 'number' ? Number(h.review_score) : null),
    reviewsCount: (typeof h.review_count === 'number' ? Number(h.review_count) : null),
  }));
}

export async function bookingGetHotelDetails(id: string): Promise<BookingHotelDetails | null> {
  const base = process.env.BOOKING_API_BASE || '';
  if (!base) return null;
  const url = new URL(`/v1/hotels/${encodeURIComponent(id)}`, base);
  const res = await fetch(url.toString(), { headers: bookingHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const h = await res.json();
  const images: string[] = Array.isArray(h?.images) ? h.images.map((i: any) => String(i.url || i.src)).filter(Boolean) : [];
  const amenities: string[] = Array.isArray(h?.amenities) ? h.amenities.map((a: any) => String(a.name || a)).filter(Boolean) : [];
  const out: BookingHotelDetails = {
    id: String(h.id || ''),
    name: String(h.name || ''),
    address: h.address || null,
    city: h.city || null,
    country: h.country || null,
    latitude: (typeof h.latitude === 'number' ? h.latitude : null),
    longitude: (typeof h.longitude === 'number' ? h.longitude : null),
    rating10: (typeof h.review_score === 'number' ? Number(h.review_score) : null),
    reviewsCount: (typeof h.review_count === 'number' ? Number(h.review_count) : null),
    website: h.website || null,
    images,
    amenities,
  };
  return out;
}


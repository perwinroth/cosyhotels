// Expedia connector (EPS Rapid/Open World)
// Notes: Requires partner credentials. Configure headers per your contract
// (e.g., Api-Key, Authorization Bearer, etc.). Endpoints here are placeholders.

export type ExpediaHotelSummary = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  rating10?: number | null;
  reviewsCount?: number | null;
};

export type ExpediaHotelDetails = ExpediaHotelSummary & {
  website?: string | null;
  images?: string[];
  amenities?: string[];
};

function expediaHeaders() {
  const headers: Record<string, string> = { 'accept': 'application/json' };
  const key = process.env.EXPEDIA_API_KEY;
  const token = process.env.EXPEDIA_ACCESS_TOKEN;
  if (key) headers['api-key'] = key;
  if (token) headers['authorization'] = `Bearer ${token}`;
  return headers;
}

export async function expediaSearchHotels(city: string): Promise<ExpediaHotelSummary[]> {
  const base = process.env.EXPEDIA_API_BASE || '';
  if (!base) return [];
  // Replace with the vendor search endpoint and params
  const url = new URL('/v3/properties/search', base);
  url.searchParams.set('city', city);
  const res = await fetch(url.toString(), { headers: expediaHeaders(), next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json = await res.json();
  const arr: any[] = Array.isArray(json?.results) ? json.results : [];
  return arr.map((h) => ({
    id: String(h.id || h.property_id || ''),
    name: String(h.name || h.title || ''),
    address: h.address || null,
    city: h.city || h.location?.city || null,
    country: h.country || h.location?.country || null,
    latitude: (typeof h.latitude === 'number' ? h.latitude : (typeof h.location?.lat === 'number' ? h.location.lat : null)),
    longitude: (typeof h.longitude === 'number' ? h.longitude : (typeof h.location?.lng === 'number' ? h.location.lng : null)),
    rating10: (typeof h.rating === 'number' ? Number(h.rating) : null),
    reviewsCount: (typeof h.reviews === 'number' ? Number(h.reviews) : null),
  }));
}

export async function expediaGetHotelDetails(id: string): Promise<ExpediaHotelDetails | null> {
  const base = process.env.EXPEDIA_API_BASE || '';
  if (!base) return null;
  const url = new URL(`/v3/properties/content/${encodeURIComponent(id)}`, base);
  const res = await fetch(url.toString(), { headers: expediaHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const h = await res.json();
  const imgsRaw = (Array.isArray(h?.images) ? h.images : (Array.isArray(h?.media) ? h.media : [])) as any[];
  const images = imgsRaw.map((i) => String(i.url || i.href || i.src)).filter(Boolean);
  const amenities: string[] = Array.isArray(h?.amenities) ? h.amenities.map((a: any) => String(a.name || a)).filter(Boolean) : [];
  const out: ExpediaHotelDetails = {
    id: String(h.id || h.property_id || id),
    name: String(h.name || ''),
    address: h.address || null,
    city: h.city || h.location?.city || null,
    country: h.country || h.location?.country || null,
    latitude: (typeof h.latitude === 'number' ? h.latitude : (typeof h.location?.lat === 'number' ? h.location.lat : null)),
    longitude: (typeof h.longitude === 'number' ? h.longitude : (typeof h.location?.lng === 'number' ? h.location.lng : null)),
    rating10: (typeof h.rating === 'number' ? Number(h.rating) : null),
    reviewsCount: (typeof h.reviews === 'number' ? Number(h.reviews) : null),
    website: h.website || null,
    images,
    amenities,
  };
  return out;
}


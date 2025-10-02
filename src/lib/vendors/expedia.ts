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
  const json: unknown = await res.json();
  const arr = getArray(json, 'results');
  return arr.map((h) => ({
    id: str(h, 'id') || str(h, 'property_id') || '',
    name: str(h, 'name') || str(h, 'title') || '',
    address: str(h, 'address'),
    city: str(h, 'city') || strDeep(h, ['location','city']),
    country: str(h, 'country') || strDeep(h, ['location','country']),
    latitude: num(h, 'latitude') ?? numDeep(h, ['location','lat']),
    longitude: num(h, 'longitude') ?? numDeep(h, ['location','lng']),
    rating10: num(h, 'rating'),
    reviewsCount: num(h, 'reviews'),
  }));
}

export async function expediaGetHotelDetails(id: string): Promise<ExpediaHotelDetails | null> {
  const base = process.env.EXPEDIA_API_BASE || '';
  if (!base) return null;
  const url = new URL(`/v3/properties/content/${encodeURIComponent(id)}`, base);
  const res = await fetch(url.toString(), { headers: expediaHeaders(), next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const h: unknown = await res.json();
  const imgsRaw = getArray(h, 'images').length ? getArray(h, 'images') : getArray(h, 'media');
  const images = imgsRaw.map((i) => (str(i, 'url') || str(i, 'href') || str(i, 'src'))).filter((u): u is string => !!u);
  const amenities: string[] = getArray(h, 'amenities')
    .map((a) => (typeof a === 'string' ? a : (str(a, 'name') || null)))
    .filter((v): v is string => !!v);
  const out: ExpediaHotelDetails = {
    id: str(h, 'id') || str(h, 'property_id') || id,
    name: str(h, 'name') || '',
    address: str(h, 'address'),
    city: str(h, 'city') || strDeep(h, ['location','city']),
    country: str(h, 'country') || strDeep(h, ['location','country']),
    latitude: num(h, 'latitude') ?? numDeep(h, ['location','lat']),
    longitude: num(h, 'longitude') ?? numDeep(h, ['location','lng']),
    rating10: num(h, 'rating'),
    reviewsCount: num(h, 'reviews'),
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
function strDeep(obj: unknown, path: string[]): string | null { let cur: unknown = obj; for (const k of path) { if (!isObj(cur)) return null; cur = cur[k]; } return typeof cur === 'string' ? cur : null; }
function numDeep(obj: unknown, path: string[]): number | null { let cur: unknown = obj; for (const k of path) { if (!isObj(cur)) return null; cur = cur[k]; } return typeof cur === 'number' ? cur : null; }

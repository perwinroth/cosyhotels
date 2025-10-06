// Amadeus connector (Hotels)
// Uses OAuth2 client-credentials to access hotel endpoints.

export type AmadeusHotelSummary = {
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

export type AmadeusHotelDetails = AmadeusHotelSummary & {
  website?: string | null;
  images?: string[];
  amenities?: string[];
};

type Token = { access_token: string; expires_in: number; token_type: string };
let cachedToken: { value: string; exp: number } | null = null;

function isObj(x: unknown): x is Record<string, unknown> { return typeof x === 'object' && x !== null; }
function getArray(obj: unknown, key: string): unknown[] { if (isObj(obj)) { const v = obj[key]; if (Array.isArray(v)) return v as unknown[]; } return []; }
function str(obj: unknown, key: string): string | null { if (!isObj(obj)) return null; const v = obj[key]; if (typeof v === 'string') return v; if (typeof v === 'number') return String(v); return null; }
function num(obj: unknown, key: string): number | null { if (!isObj(obj)) return null; const v = obj[key]; if (typeof v === 'number') return v; return null; }
function pick(obj: unknown, keys: string[]): unknown { let cur: unknown = obj; for (const k of keys) { if (!isObj(cur)) return null; cur = cur[k]; } return cur; }
function strDeep(obj: unknown, path: string[]): string | null { const v = pick(obj, path); return typeof v === 'string' ? v : null; }
function numDeep(obj: unknown, path: string[]): number | null { const v = pick(obj, path); return typeof v === 'number' ? v : null; }

function baseUrl() {
  // Default to test environment unless explicitly overridden
  return process.env.AMADEUS_API_BASE || 'https://test.api.amadeus.com';
}

async function getAccessToken(): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 30) return cachedToken.value;
  const clientId = process.env.AMADEUS_API_KEY;
  const clientSecret = process.env.AMADEUS_API_SECRET;
  if (!clientId || !clientSecret) return null;
  const url = `${baseUrl()}/v1/security/oauth2/token`;
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString(), cache: 'no-store' });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const token = isObj(json) ? (json as unknown as Token) : null;
  const access = token?.access_token || null;
  const exp = token ? (now + (token.expires_in || 0)) : 0;
  if (access) cachedToken = { value: access, exp };
  return access;
}

async function authHeaders() {
  const t = await getAccessToken();
  if (!t) return null;
  return { accept: 'application/json', authorization: `Bearer ${t}` } as Record<string, string>;
}

async function getCityCode(city: string): Promise<string | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const url = new URL(`${baseUrl()}/v1/reference-data/locations`);
  url.searchParams.set('subType', 'CITY');
  url.searchParams.set('keyword', city);
  const res = await fetch(url.toString(), { headers, next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const arr = getArray(json, 'data');
  const first = arr[0];
  const code = str(first, 'iataCode');
  return code || null;
}

export async function amadeusSearchHotels(city: string): Promise<AmadeusHotelSummary[]> {
  const headers = await authHeaders();
  if (!headers) return [];
  const code = await getCityCode(city);
  if (!code) return [];
  const url = new URL(`${baseUrl()}/v1/reference-data/locations/hotels/by-city`);
  url.searchParams.set('cityCode', code);
  const res = await fetch(url.toString(), { headers, next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json: unknown = await res.json();
  const arr = getArray(json, 'data');
  // This endpoint returns hotelId and name
  return arr.map((h) => ({
    id: str(h, 'hotelId') || '',
    name: str(h, 'name') || '',
    address: null,
    city,
    country: null,
    latitude: null,
    longitude: null,
    rating10: null,
    reviewsCount: null,
  })).filter((h) => h.id);
}

export async function amadeusGetHotelDetails(hotelId: string): Promise<AmadeusHotelDetails | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const url = new URL(`${baseUrl()}/v3/shopping/hotel-offers`);
  url.searchParams.set('hotelIds', hotelId);
  url.searchParams.set('includeClosed', 'false');
  url.searchParams.set('bestRateOnly', 'false');
  url.searchParams.set('view', 'FULL');
  // Provide simple dates to increase data availability
  try {
    const today = new Date();
    const checkIn = new Date(today.getTime() + 14 * 86400000);
    const checkOut = new Date(today.getTime() + 15 * 86400000);
    const ci = checkIn.toISOString().slice(0, 10);
    const co = checkOut.toISOString().slice(0, 10);
    url.searchParams.set('adults', '2');
    url.searchParams.set('roomQuantity', '1');
    url.searchParams.set('checkInDate', ci);
    url.searchParams.set('checkOutDate', co);
  } catch {}
  const res = await fetch(url.toString(), { headers, next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const json: unknown = await res.json();
  const arr = getArray(json, 'data');
  const first = arr[0];
  const name = strDeep(first, ['hotel','name']) || '';
  const city = strDeep(first, ['hotel','address','cityName']);
  const country = strDeep(first, ['hotel','address','countryCode']);
  // Address lines may be array; skip for now (null)
  const address = null;
  const lat = numDeep(first, ['hotel','geoCode','latitude']);
  const lng = numDeep(first, ['hotel','geoCode','longitude']);
  const ratingStr = strDeep(first, ['hotel','rating']);
  const stars = ratingStr ? Number(ratingStr) : NaN;
  // Try media images if available
  let images: string[] = [];
  const hotelObj = isObj(first) && isObj(first.hotel) ? (first.hotel as Record<string, unknown>) : null;
  if (hotelObj && Array.isArray((hotelObj as any).media)) {
    images = ((hotelObj as any).media as unknown[])
      .map((m) => (isObj(m) ? (str(m, 'uri') || str(m, 'url')) : null))
      .filter((u): u is string => !!u);
  }
  const details: AmadeusHotelDetails = {
    id: hotelId,
    name,
    address,
    city: city || null,
    country: country || null,
    latitude: lat ?? null,
    longitude: lng ?? null,
    rating10: Number.isFinite(stars) ? stars * 2 : null,
    reviewsCount: null,
    website: null,
    images,
    amenities: [],
  };
  return details;
}

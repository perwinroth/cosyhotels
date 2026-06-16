// OpenStreetMap connector (Hotels) — free, no API key, no billing.
// Replaces Amadeus. Uses Nominatim for city -> bounding box, then the
// Overpass API to list lodging (hotel / guest_house / chalet / B&B / hostel).
//
// Hard-won gotchas baked in:
//  1. Overpass + Nominatim REQUIRE a descriptive User-Agent or you get 406/403.
//  2. The main overpass-api.de host is frequently "too busy" -> we fall back
//     across several public mirrors until one returns JSON.
//  3. Query by bounding box (fast) instead of by named area (heavy, times out).

export type OSMHotel = {
  id: string;            // e.g. "node/12345"
  name: string;
  lat: number;
  lng: number;
  website?: string | null;
  stars?: number | null; // 0..5 if tagged
  type: string;          // hotel | guest_house | chalet | hostel | motel | apartment | bed_and_breakfast
  brand?: string | null; // present => almost certainly a chain
  rooms?: number | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  wikidata?: string | null;   // OSM 'wikidata' tag (Qxxxx) -> Wikimedia image
  imageTag?: string | null;   // OSM 'image' tag (direct photo URL)
};

const UA = 'cosyhotels/1.0 (+https://cosyhotels.example; hotel discovery bot)';

// Public Overpass endpoints, tried in order. The main host is listed last
// because it is the most frequently overloaded.
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 90000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------- Nominatim geocoding (city -> bbox) ----------
type BBox = { south: number; west: number; north: number; east: number; country?: string | null };

const bboxCache = new Map<string, BBox | null>();

export async function geocodeCity(city: string): Promise<BBox | null> {
  const key = city.trim().toLowerCase();
  if (bboxCache.has(key)) return bboxCache.get(key) ?? null;
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', city);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('featuretype', 'city');
    const res = await fetchWithTimeout(url.toString(), {
      headers: { 'User-Agent': UA, accept: 'application/json' },
    });
    if (!res.ok) { bboxCache.set(key, null); return null; }
    const arr: unknown = await res.json();
    const first = Array.isArray(arr) ? arr[0] : null;
    if (!isObj(first) || !Array.isArray(first.boundingbox)) { bboxCache.set(key, null); return null; }
    // Nominatim boundingbox = [south, north, west, east] as strings
    const bb = first.boundingbox as string[];
    const south = Number(bb[0]);
    const north = Number(bb[1]);
    const west = Number(bb[2]);
    const east = Number(bb[3]);
    if (![south, north, west, east].every(Number.isFinite)) { bboxCache.set(key, null); return null; }
    const country = typeof first.display_name === 'string'
      ? String(first.display_name).split(',').pop()?.trim() ?? null
      : null;
    const box: BBox = { south, west, north, east, country };
    bboxCache.set(key, box);
    return box;
  } catch {
    bboxCache.set(key, null);
    return null;
  }
}

// ---------- Overpass query with mirror fallback ----------
async function overpass(query: string): Promise<unknown | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }).toString(),
      });
      if (!res.ok) continue;
      const text = await res.text();
      // Busy/erroring mirrors return HTML, not JSON.
      if (!text.trim().startsWith('{')) continue;
      return JSON.parse(text);
    } catch {
      // try next mirror
    }
  }
  return null;
}

function tagStr(tags: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = tags[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function composeAddress(tags: Record<string, unknown>): string | null {
  const num = tagStr(tags, 'addr:housenumber', 'contact:housenumber');
  const street = tagStr(tags, 'addr:street', 'contact:street');
  const postcode = tagStr(tags, 'addr:postcode', 'contact:postcode');
  const cityName = tagStr(tags, 'addr:city', 'contact:city');
  const parts = [
    [num, street].filter(Boolean).join(' '),
    postcode,
    cityName,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

// Lodging types we treat as cosy candidates. We EXCLUDE nothing here — the
// cosy scorer decides; hostels/motels just tend to score low.
// NOTE: 'chalet' and 'apartment' are intentionally omitted from the default
// net: outside dense tourist cities they are mostly private holiday cottages /
// numbered cabins, not bookable cosy hotels, and they pollute results badly.
const LODGING = ['hotel', 'guest_house', 'hostel', 'motel'];

// Cap results per city. Cosy sites are curated; we don't need thousands.
const MAX_RESULTS = 300;

// Quality gate: is this OSM entry a real, bookable place to stay (not a pub,
// restaurant, scout cabin, numbered holiday cottage, or junk tag)?
function isRealLodging(name: string, tags: Record<string, unknown>, type: string): boolean {
  const n = name.toLowerCase();

  // 1) Name must be substantive (reject "Ev", "&hotel", single chars, etc.)
  const clean = n.replace(/[^a-zà-ÿ0-9]/gi, '');
  if (clean.length < 3) return false;

  // 2) Reject names that are clearly food/drink venues mis-tagged as lodging.
  //    'krog'/'krogen' = Swedish pub, 'pub', 'bar', 'restaurang', 'café'...
  const FOOD = /\b(krog|krogen|pub|bar|brewery|bryggeri|restaurang|restaurant|trattoria|osteria|bistro|brasserie|taverna|café|kafé|coffee|pizzeria|grill|diner)\b/i;
  if (FOOD.test(n)) return false;

  // 3) Reject scout/holiday-cabin / numbered-cottage patterns (very common in
  //    Nordic OSM): "stugby", "stuga", "scoutkår", "vandrarhem annex", or a
  //    name that is basically a cadastral number like "Solgård 3:38 Hus".
  const CABIN = /\b(stugby|stuga|stugor|scout|koloni|kolonistuga|campground|camping|caravan)\b/i;
  if (CABIN.test(n)) return false;
  if (/\d+:\d+/.test(n)) return false; // Swedish property designations e.g. 3:38

  // 4) Type must be one we trust as a real establishment.
  if (!LODGING.includes(type)) return false;

  // 5) Heuristic: a real hotel/guesthouse usually has at least ONE corroborating
  //    signal — stars, a website, rooms, an address, or the word hotel/hostel/
  //    inn/guest in the name. A bare node with only a name is usually junk.
  const hasSignal = !!(
    tagStr(tags, 'stars') || tagStr(tags, 'website', 'contact:website') ||
    tagStr(tags, 'rooms') || tagStr(tags, 'addr:street', 'contact:street') ||
    tagStr(tags, 'phone', 'contact:phone') || tagStr(tags, 'wikidata') ||
    /\b(hotel|hôtel|hostel|inn|guest|pension|pensionat|b&b|bed|herberge|albergo|ostello|auberge|gasthof|gästehaus|vandrarhem|värdshus|hotell)\b/i.test(n)
  );
  return hasSignal;
}

export async function osmSearchHotels(city: string): Promise<OSMHotel[]> {
  const box = await geocodeCity(city);
  if (!box) return [];
  const { south, west, north, east, country } = box;
  const bbox = `${south},${west},${north},${east}`;
  // IMPORTANT: a single regex-matched `nwr` clause is dramatically faster than
  // 12 separate node/way clauses (which time out on Overpass). `nwr` matches
  // nodes, ways AND relations in one pass; `out center` gives ways a centroid.
  const typeRe = `^(${LODGING.join('|')})$`;
  const query = `
    [out:json][timeout:60];
    (
      nwr["tourism"~"${typeRe}"]["name"](${bbox});
    );
    out tags center ${MAX_RESULTS};
  `;
  const json = await overpass(query);
  if (!isObj(json) || !Array.isArray(json.elements)) return [];

  const out: OSMHotel[] = [];
  for (const el of json.elements as unknown[]) {
    if (!isObj(el)) continue;
    const tags = isObj(el.tags) ? el.tags as Record<string, unknown> : {};
    const name = tagStr(tags, 'name');
    if (!name) continue;
    const type = tagStr(tags, 'tourism') || 'hotel';
    // QUALITY FILTER — OSM is noisy outside big tourist cities. Reject entries
    // that are clearly not bookable cosy hotels, so the listing stays trustworthy.
    if (!isRealLodging(name, tags, type)) continue;
    // coords: nodes have lat/lon; ways have center
    const center = isObj(el.center) ? el.center as Record<string, unknown> : null;
    const lat = typeof el.lat === 'number' ? el.lat : (typeof center?.lat === 'number' ? center.lat as number : NaN);
    const lng = typeof el.lon === 'number' ? el.lon : (typeof center?.lon === 'number' ? center.lon as number : NaN);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const starsStr = tagStr(tags, 'stars');
    const stars = starsStr ? Number(starsStr) : null;
    const roomsStr = tagStr(tags, 'rooms');
    const rooms = roomsStr ? Number(roomsStr) : null;
    const id = `${typeof el.type === 'string' ? el.type : 'node'}/${typeof el.id === 'number' ? el.id : ''}`;
    out.push({
      id,
      name,
      lat,
      lng,
      website: tagStr(tags, 'website', 'contact:website'),
      stars: stars != null && Number.isFinite(stars) ? stars : null,
      type,
      brand: tagStr(tags, 'brand'),
      rooms: rooms != null && Number.isFinite(rooms) ? rooms : null,
      address: composeAddress(tags),
      city: tagStr(tags, 'addr:city', 'contact:city') || city,
      country: country || null,
      wikidata: tagStr(tags, 'wikidata', 'brand:wikidata'),
      imageTag: tagStr(tags, 'image'),
    });
  }
  return out;
}

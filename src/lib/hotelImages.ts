/*
  Hotel image retrieval pipeline with fallbacks and caching.
  Steps:
  1) Amadeus hotel media (if credentials available)
  2) Official website OG/link image (via search -> website parse)
  3) Image search API (Google CSE / Bing)
  4) Placeholder

  Notes:
  - Designed for server-side usage in Next.js (global fetch available)
  - Uses in-memory TTL cache; consider replacing with a shared cache in prod
*/

type SourceTag = 'amadeus' | 'website' | 'scrape_search' | 'placeholder';

export type ImageMeta = {
  url: string;
  source: SourceTag;
  width?: number;
  height?: number;
  type?: string; // MIME type
};

type PipelineInput = {
  hotelId: string;
  name: string;
  city?: string;
  topN?: number;
};

type CacheEntry = {
  images: ImageMeta[];
  fetchedAt: number;
  step: SourceTag;
};

const CACHE_TTL_MS = parseInt(process.env.HOTEL_IMAGE_CACHE_TTL_MS || '86400000', 10); // 24h
const REQUEST_TIMEOUT_MS = parseInt(process.env.HOTEL_IMAGE_TIMEOUT_MS || '8000', 10);
const PLACEHOLDER_URL = process.env.HOTEL_IMAGE_PLACEHOLDER_URL || 'https://placehold.co/800x600?text=Hotel+Image';

const cache = new Map<string, CacheEntry>();

function withTimeout(resource: string, options: RequestInit = {}, ms = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(resource, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
}

async function headOrGet(url: string): Promise<{ ok: boolean; type?: string; width?: number; height?: number }>
{
  try {
    const res = await withTimeout(url, { method: 'HEAD' });
    if (res.ok) return { ok: true, type: res.headers.get('content-type') || undefined };
  } catch (_) {
    // fall through to GET
  }
  try {
    const res = await withTimeout(url, { method: 'GET' });
    return { ok: res.ok, type: res.headers.get('content-type') || undefined };
  } catch (_) {
    return { ok: false };
  }
}

/* ========================
   Amadeus API helpers
   ======================== */

async function getAmadeusToken(): Promise<string | null> {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) return null;
  const authUrl = process.env.AMADEUS_AUTH_URL || 'https://test.api.amadeus.com/v1/security/oauth2/token';
  try {
    const res = await withTimeout(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: key, client_secret: secret }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function fetchAmadeusHotelImages(hotelId: string, view: 'SMALL' | 'FULL' = 'FULL'): Promise<ImageMeta[] | null> {
  const token = await getAmadeusToken();
  if (!token) return null;
  const base = process.env.AMADEUS_HOTEL_MEDIA_URL || 'https://test.api.amadeus.com/v2/reference-data/locations/hotels/photos';
  const url = `${base}?hotelIds=${encodeURIComponent(hotelId)}&view=${encodeURIComponent(view)}`;

  try {
    const res = await withTimeout(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Support common shapes: data[].media[] or data[].photos[]
    const data = Array.isArray(json?.data) ? json.data : [];
    const mediaItems: any[] = data.flatMap((d: any) => d?.media || d?.photos || []);
    const candidates = mediaItems
      .map((m: any) => {
        const url = m?.uri || m?.url || m?.link || null;
        if (!url) return null;
        const type = m?.type || m?.category;
        return { url, type } as Partial<ImageMeta> & { url: string };
      })
      .filter(Boolean) as { url: string; type?: string }[];

    const results: ImageMeta[] = [];
    for (const c of candidates) {
      const v = await headOrGet(c.url);
      if (v.ok) results.push({ url: c.url, source: 'amadeus', type: v.type || c.type });
    }
    return results.length ? results : null;
  } catch {
    return null;
  }
}

/* ========================
   Website discovery + parse (no Google APIs)
   ======================== */

function plausibleOfficialDomain(name: string, city?: string) {
  const tokens = [name, city].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  return (host: string) => tokens.some((t) => host.includes(t));
}

// Minimal HTML search scrape using Bing's public web results (no API).
// Parses top anchors; may break if markup changes.
async function scrapeSearchResults(query: string, max = 5): Promise<string[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await withTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cosyhotels-bot/1.0)' } });
    if (!res.ok) return [];
    const html = await res.text();
    const links = Array.from(html.matchAll(/<li class=\"b_algo\"[\s\S]*?<h2>[\s\S]*?<a[^>]+href=\"([^\"]+)\"/gi)).map(m => m[1]);
    if (links.length) return links.slice(0, max);
    // fallback: generic <a> extraction
    const generic = Array.from(html.matchAll(/<a[^>]+href=\"([^\"]+)\"[^>]*>/gi)).map(m => m[1]);
    return generic.filter(h => /^https?:\/\//i.test(h)).slice(0, max);
  } catch {
    return [];
  }
}

function extractFirstImageFromHtml(html: string, baseUrl?: string): string | null {
  // Try og:image
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i);
  if (ogMatch?.[1]) return absolutizeUrl(ogMatch[1], baseUrl);
  // Try link rel=image_src
  const linkMatch = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i) ||
                    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/i);
  if (linkMatch?.[1]) return absolutizeUrl(linkMatch[1], baseUrl);
  // Try first prominent <img>
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (imgMatch?.[1]) return absolutizeUrl(imgMatch[1], baseUrl);
  return null;
}

function absolutizeUrl(url: string, base?: string): string {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

async function discoverOfficialWebsite(name: string, city?: string): Promise<string | null> {
  const query = `Hotel ${name} ${city || ''} official website`.trim();
  const links = await scrapeSearchResults(query, 8);
  if (!links.length) return null;
  const isPlausible = plausibleOfficialDomain(name, city);
  for (const link of links) {
    try {
      const host = new URL(link).hostname.toLowerCase();
      if (isPlausible(host)) return link;
    } catch { /* ignore bad url */ }
  }
  return links[0] || null;
}

async function fetchWebsiteImage(name: string, city?: string): Promise<ImageMeta[] | null> {
  const site = await discoverOfficialWebsite(name, city);
  if (!site) return null;
  try {
    const res = await withTimeout(site);
    if (!res.ok) return null;
    const html = await res.text();
    const imgUrl = extractFirstImageFromHtml(html, site);
    if (!imgUrl) return null;
    const v = await headOrGet(imgUrl);
    if (!v.ok) return null;
    return [{ url: imgUrl, source: 'website', type: v.type }];
  } catch {
    return null;
  }
}

/* ========================
   Scrape-based image fallback
   ======================== */

async function scrapeImagesFromPage(url: string, max = 6): Promise<string[]> {
  try {
    const res = await withTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; cosyhotels-bot/1.0)' } });
    if (!res.ok) return [];
    const html = await res.text();
    const candidates = new Set<string>();
    // Prefer meta/link first
    const og = extractFirstImageFromHtml(html, url);
    if (og) candidates.add(og);
    // Then all <img> sources
    const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgRe.exec(html)) !== null && candidates.size < max * 3) {
      const abs = absolutizeUrl(m[1], url);
      if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(abs)) candidates.add(abs);
    }
    // Filter out tiny assets by filename hints
    const filtered = Array.from(candidates).filter(u => !/(icon|sprite|logo|thumb|\bmin\b)/i.test(u));
    return filtered.slice(0, max * 2);
  } catch {
    return [];
  }
}

async function scrapeSearchForImages(name: string, city?: string, topN = 5): Promise<ImageMeta[] | null> {
  const q = `Hotel ${name} ${city || ''} photos images`.trim();
  const links = await scrapeSearchResults(q, 8);
  if (!links.length) return null;
  const isPlausible = plausibleOfficialDomain(name, city);
  const images: ImageMeta[] = [];
  for (const page of links) {
    try {
      const host = new URL(page).hostname.toLowerCase();
      if (!isPlausible(host)) continue;
      const urls = await scrapeImagesFromPage(page, topN);
      for (const u of urls) {
        const v = await headOrGet(u);
        if (!v.ok) continue;
        images.push({ url: u, source: 'scrape_search', type: v.type });
        if (images.length >= topN) return images;
      }
    } catch { /* ignore */ }
  }
  return images.length ? images : null;
}

/* ========================
   Public API
   ======================== */

export async function getHotelImages(input: PipelineInput): Promise<{ images: ImageMeta[]; step: SourceTag }>
{
  const key = input.hotelId;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return { images: cached.images, step: cached.step };
  }

  // 1) Amadeus
  const fromAmadeus = await fetchAmadeusHotelImages(input.hotelId, 'FULL');
  if (fromAmadeus?.length) {
    cache.set(key, { images: fromAmadeus, fetchedAt: now, step: 'amadeus' });
    return { images: fromAmadeus, step: 'amadeus' };
  }

  // 2) Official website parse
  const fromWebsite = await fetchWebsiteImage(input.name, input.city);
  if (fromWebsite?.length) {
    cache.set(key, { images: fromWebsite, fetchedAt: now, step: 'website' });
    return { images: fromWebsite, step: 'website' };
  }

  // 3) Scrape search results for image candidates
  const topN = input.topN ?? 5;
  const fromSearch = await scrapeSearchForImages(input.name, input.city, topN);
  if (fromSearch?.length) {
    cache.set(key, { images: fromSearch, fetchedAt: now, step: 'scrape_search' });
    return { images: fromSearch, step: 'scrape_search' };
  }

  // 4) Placeholder
  const v = await headOrGet(PLACEHOLDER_URL);
  const placeholder: ImageMeta = { url: PLACEHOLDER_URL, source: 'placeholder', type: v.type };
  cache.set(key, { images: [placeholder], fetchedAt: now, step: 'placeholder' });
  return { images: [placeholder], step: 'placeholder' };
}

export async function getImagesForHotels(hotels: Array<{ hotelId: string; name: string; city?: string; topN?: number }>): Promise<Record<string, ImageMeta[]>>
{
  const results: Record<string, ImageMeta[]> = {};
  const tasks = hotels.map(async (h) => {
    try {
      const { images, step } = await getHotelImages(h);
      results[h.hotelId] = images;
      console.info(`[hotelImages] ${h.hotelId} → ${step} (${images.length} images)`);
    } catch (e) {
      console.warn(`[hotelImages] ${h.hotelId} failed:`, e);
      results[h.hotelId] = [{ url: PLACEHOLDER_URL, source: 'placeholder' }];
    }
  });
  await Promise.allSettled(tasks);
  return results;
}

// Convenience wrapper used across pages/routes to fetch a single representative image URL
// for a hotel. It leverages the pipeline (Amadeus → website → search → placeholder) and
// returns the first image URL if available, otherwise null.
export async function getImageForHotel(
  name: string,
  city: string = '',
  _maxWidth: number = 800,
  slug?: string,
  hotelId?: string,
): Promise<string | null> {
  const key = hotelId || slug || `${name}:${city}`;
  try {
    const { images } = await getHotelImages({ hotelId: key, name, city, topN: 3 });
    return images[0]?.url || null;
  } catch {
    return null;
  }
}

/* ========================
   Environment variables (optional)
   ========================
   - AMADEUS_API_KEY, AMADEUS_API_SECRET
   - AMADEUS_AUTH_URL (default: https://test.api.amadeus.com/v1/security/oauth2/token)
   - AMADEUS_HOTEL_MEDIA_URL (default: https://test.api.amadeus.com/v2/reference-data/locations/hotels/photos)
   - No Google services required for scraping path
   - HOTEL_IMAGE_CACHE_TTL_MS (default: 86400000)
   - HOTEL_IMAGE_TIMEOUT_MS (default: 8000)
   - HOTEL_IMAGE_PLACEHOLDER_URL (default: https://placehold.co/800x600?text=Hotel+Image)
*/

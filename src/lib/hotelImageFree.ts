// Free, no-key, legally-cacheable hotel image resolver.
//
// Strategy (in priority order), all sources are free and permit storage:
//   1. Hotel's OWN website og:image / twitter:image / JSON-LD image
//      -> their own marketing photo; clearly licensed for promoting them.
//   2. Wikidata (P18 image) for the hotel, via OSM wikidata/wikipedia tags
//      or a name+coords lookup -> Wikimedia Commons (free license).
//   3. Placeholder (last resort).
//
// Deliberately NO Google Places here: its ToS forbids long-term caching.

import { placeholderUrl } from './image';

export type ResolvedImage = {
  url: string;
  source: 'website' | 'wikimedia' | 'placeholder';
  attribution?: string | null;
};

const UA = 'cosyhotels/1.0 (+https://cosyhotels.example; image resolver)';
const TIMEOUT = 8000;

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function headOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    let res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: controller.signal, redirect: 'follow' });
    if (res.ok) {
      const ct = res.headers.get('content-type') || '';
      return ct.startsWith('image/');
    }
    // Some servers reject HEAD; try a tiny ranged GET
    res = await fetch(url, { method: 'GET', headers: { 'User-Agent': UA, range: 'bytes=0-0' }, signal: controller.signal, redirect: 'follow' });
    const ct = res.headers.get('content-type') || '';
    return res.ok && ct.startsWith('image/');
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}

function abs(u: string, base: string): string | null {
  try { return new URL(u, base).toString(); } catch { return null; }
}

// ---------- 1) Website og:image ----------
function extractMetaImage(html: string, base: string): string | null {
  // og:image (and variants) — handle both attribute orderings
  const patterns: RegExp[] = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      const u = abs(m[1], base);
      if (u && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u)) return u;
      if (u) return u; // og:image without extension is still usually valid
    }
  }
  // JSON-LD "image"
  const ld = html.match(/"image"\s*:\s*"([^"']+\.(?:jpe?g|png|webp|avif)[^"']*)"/i);
  if (ld?.[1]) return abs(ld[1], base);
  return null;
}

async function fromWebsite(website?: string | null): Promise<ResolvedImage | null> {
  if (!website) return null;
  const html = await fetchText(website);
  if (!html) return null;
  const img = extractMetaImage(html, website);
  if (!img) return null;
  if (!/(logo|icon|sprite|favicon|placeholder)/i.test(img) && await headOk(img)) {
    return { url: img, source: 'website', attribution: null };
  }
  return null;
}

// ---------- 2) Wikidata / Wikimedia Commons ----------
// If OSM gave us a wikidata QID, fetch P18 (image) directly.
async function fromWikidataQid(qid?: string | null): Promise<ResolvedImage | null> {
  if (!qid || !/^Q\d+$/.test(qid)) return null;
  try {
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    const entities = (json as Record<string, unknown>)?.entities as Record<string, unknown> | undefined;
    const ent = entities?.[qid] as Record<string, unknown> | undefined;
    const claims = ent?.claims as Record<string, unknown> | undefined;
    const p18 = claims?.P18 as unknown[] | undefined;
    const first = p18?.[0] as Record<string, unknown> | undefined;
    const mainsnak = first?.mainsnak as Record<string, unknown> | undefined;
    const datavalue = mainsnak?.datavalue as Record<string, unknown> | undefined;
    const filename = datavalue?.value;
    if (typeof filename !== 'string') return null;
    // Commons file -> direct thumbnail URL via Special:FilePath
    const commons = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=800`;
    return { url: commons, source: 'wikimedia', attribution: `Wikimedia Commons: ${filename}` };
  } catch {
    return null;
  }
}

// ---------- 2b) Wikimedia Commons geosearch (by coordinates) ----------
// Finds Commons images near the hotel, but ONLY accepts a result whose file
// title actually matches the hotel name. This prevents grabbing random nearby
// street scenes / deliveries / landmarks that merely share a location.
// (Trust over coverage: a wrong photo is worse than an honest placeholder.)
function nameTokens(name: string): string[] {
  const stop = new Set(['hotel', 'hôtel', 'the', 'de', 'du', 'la', 'le', 'les', 'des', 'and', 'of', 'et', 'b', 'and']);
  return name
    .toLowerCase()
    .normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !stop.has(t));
}

async function fromCommonsGeo(name: string, lat?: number | null, lng?: number | null): Promise<ResolvedImage | null> {
  if (lat == null || lng == null) return null;
  const tokens = nameTokens(name);
  if (!tokens.length) return null; // nothing distinctive to match against
  try {
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.searchParams.set('action', 'query');
    api.searchParams.set('format', 'json');
    api.searchParams.set('generator', 'geosearch');
    api.searchParams.set('ggscoord', `${lat}|${lng}`);
    api.searchParams.set('ggsradius', '120'); // metres
    api.searchParams.set('ggslimit', '20');
    api.searchParams.set('ggsnamespace', '6'); // File:
    api.searchParams.set('prop', 'imageinfo');
    api.searchParams.set('iiprop', 'url|extmetadata');
    api.searchParams.set('iiurlwidth', '800');
    const res = await fetch(api.toString(), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) return null;
    const json = await res.json() as { query?: { pages?: Record<string, unknown> } };
    const pages = json.query?.pages;
    if (!pages) return null;
    for (const p of Object.values(pages)) {
      if (!isObjLocal(p)) continue;
      const title = typeof p.title === 'string' ? p.title.toLowerCase() : '';
      if (/\.(svg|pdf|ogg|webm)$/i.test(title)) continue;
      if (/(map|logo|icon|plan|diagram|coat of arms|flag|livraison|delivery|construction|travaux|sign|plaque|statue|monument|fountain|fontaine|\brue\b|street|panneau|sculpture)/i.test(title)) continue;
      // REQUIRE the hotel name to appear in the file title — proves it's the hotel.
      const matches = tokens.some((t) => title.includes(t));
      if (!matches) continue;
      const ii = Array.isArray(p.imageinfo) ? p.imageinfo[0] as Record<string, unknown> : null;
      const thumb = ii?.thumburl || ii?.url;
      if (typeof thumb === 'string') {
        return { url: thumb, source: 'wikimedia', attribution: p.title ? String(p.title).replace(/^File:/, 'Wikimedia: ') : null };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isObjLocal(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

export type ImageResolveInput = {
  name: string;
  website?: string | null;
  wikidata?: string | null;
  imageTag?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
};

// Main entry: returns the best free, cacheable image we can find.
export async function resolveHotelImage(input: ImageResolveInput): Promise<ResolvedImage> {
  // 0) Direct OSM image tag (rare but authoritative)
  if (input.imageTag && /^https?:\/\//i.test(input.imageTag) && await headOk(input.imageTag)) {
    return { url: input.imageTag, source: 'website', attribution: null };
  }

  // 1) Website og:image (best — the hotel's own photo)
  const web = await fromWebsite(input.website);
  if (web) return web;

  // 2) Wikidata image (free license)
  const wiki = await fromWikidataQid(input.wikidata);
  if (wiki) return wiki;

  // 3) Wikimedia Commons geosearch by coordinates, NAME-MATCHED only
  const geo = await fromCommonsGeo(input.name, input.lat, input.lng);
  if (geo) return geo;

  // 4) Placeholder
  return { url: placeholderUrl, source: 'placeholder', attribution: null };
}

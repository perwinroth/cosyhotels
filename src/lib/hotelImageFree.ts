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

// Reject non-photo junk that hotels put in og:image / first <img>: logos, icons, flags,
// QR codes, banners, payment/social badges, cookie/consent graphics, locale flags, SVGs.
const JUNK_IMG = /(logo|icon|wi-?fi|sprite|favicon|placeholder|dummy|ghost|blank|fallback|\bvector\b|ogp|og[-_]?image|ogimg|kachel|screenshot|coming[-_]?soon|social[-_]?media|weather|bookcdn|polylang|\/mini\.|qr[-_]?code|qrcode|\bflag\b|flags?\/|banner|cookie|consent|gdpr|badge|payment|visa|mastercard|paypal|coat[-_]?of[-_]?arms|emblem|crest|\.svg(\?|$)|[a-z]{2}[-_][A-Z]{2}\.(?:png|jpe?g|gif))/i;

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

async function fromWebsite(website?: string | null, exclude?: Set<string>): Promise<ResolvedImage | null> {
  if (!website) return null;
  const html = await fetchText(website);
  if (!html) return null;
  // 1) og:image / twitter:image / JSON-LD (best — curated hero shot). Skip it when excluded
  //    (it was already QA-rejected) so we fall through to the <img> scan / other sources.
  const meta = extractMetaImage(html, website);
  if (meta && !exclude?.has(meta) && !JUNK_IMG.test(meta) && await headOk(meta)) {
    return { url: meta, source: 'website', attribution: null };
  }
  // 2) Fallback: scan <img> + CSS background-image for the first large photo.
  const JUNK = /(logo|icon|wi-?fi|sprite|favicon|thumb|avatar|pixel|spacer|blank|placeholder|dummy|ghost|fallback|\bvector\b|ogp|og[-_]?image|ogimg|kachel|screenshot|coming[-_]?soon|social[-_]?media|banner-ad|loader|btn|button|arrow|flag|badge|seal|whatsapp|facebook|instagram|twitter|payment|visa|mastercard|cookie|map|weather|bookcdn|polylang|\/mini\.|[a-z]{2}_[A-Z]{2}\.(?:png|jpe?g|svg))/i;
  const cand: string[] = [];
  for (const m of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) {
    const u = abs(m[1], website);
    if (u && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && !JUNK.test(u)) cand.push(u);
  }
  for (const m of html.matchAll(/background(?:-image)?\s*:\s*url\(["']?([^"')]+)/gi)) {
    const u = abs(m[1], website);
    if (u && /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) && !JUNK.test(u)) cand.push(u);
  }
  // Validate the first few; return the first that is a live image.
  const seen = new Set<string>();
  for (const u of cand) {
    if (seen.has(u) || exclude?.has(u)) continue;
    seen.add(u);
    if (await headOk(u)) return { url: u, source: 'website', attribution: null };
    if (seen.size >= 6) break;
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

// ---------- 3b) Instagram profile og:image (LAST RESORT) ----------
// IG blocks scraping of actual posts, so the only fetchable image is the profile og:image —
// usually a logo (the JUNK_IMG filter drops most). Low yield, but free; fetched from the
// caller's IP (residential, when run from a local script) so it sometimes succeeds.
async function fromInstagram(handle?: string | null, exclude?: Set<string>): Promise<ResolvedImage | null> {
  const h = (handle || '').replace(/^@/, '').trim();
  if (!h || !/^[A-Za-z0-9._]{1,40}$/.test(h)) return null;
  const html = await fetchText(`https://www.instagram.com/${encodeURIComponent(h)}/`);
  if (!html) return null;
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        || html.match(/"profile_pic_url_hd"\s*:\s*"([^"]+)"/i);
  const u = m?.[1] ? abs(m[1].replace(/\\u0026/g, '&'), 'https://www.instagram.com') : null;
  if (u && !exclude?.has(u) && !JUNK_IMG.test(u) && await headOk(u)) {
    return { url: u, source: 'website', attribution: `Instagram @${h}` };
  }
  return null;
}

export type ImageResolveInput = {
  name: string;
  website?: string | null;
  wikidata?: string | null;
  imageTag?: string | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  instagram?: string | null; // optional IG handle — last-resort profile og:image (low yield: often a logo)
  exclude?: string[]; // URLs to skip (e.g. an image that already failed vision QA) so a
                      // re-resolve returns a genuinely DIFFERENT photo, not the same junk.
};

// Main entry: returns the best free, cacheable image we can find.
export async function resolveHotelImage(input: ImageResolveInput): Promise<ResolvedImage> {
  const exclude = input.exclude?.length ? new Set(input.exclude) : undefined;
  const notExcluded = (r: ResolvedImage | null): ResolvedImage | null =>
    r && !exclude?.has(r.url) ? r : null;

  // 0) Direct OSM image tag (rare but authoritative)
  if (input.imageTag && /^https?:\/\//i.test(input.imageTag) && !exclude?.has(input.imageTag) && await headOk(input.imageTag)) {
    return { url: input.imageTag, source: 'website', attribution: null };
  }

  // 1) Website og:image (best — the hotel's own photo); skips excluded URLs internally.
  const web = await fromWebsite(input.website, exclude);
  if (web) return web;

  // 2) Wikidata image (free license)
  const wiki = notExcluded(await fromWikidataQid(input.wikidata));
  if (wiki) return wiki;

  // 3) Wikimedia Commons geosearch by coordinates, NAME-MATCHED only
  const geo = notExcluded(await fromCommonsGeo(input.name, input.lat, input.lng));
  if (geo) return geo;

  // 4) Instagram profile og:image (last resort — often a logo, junk-filtered)
  const ig = notExcluded(await fromInstagram(input.instagram, exclude));
  if (ig) return ig;

  // 5) Placeholder
  return { url: placeholderUrl, source: 'placeholder', attribution: null };
}

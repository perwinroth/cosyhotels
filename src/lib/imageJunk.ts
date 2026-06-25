// Stage-1 junk filter for hotel photos — FREE, deterministic, no model, no API.
// Catches the bulk of what slips into hotel_images from og:image / first-<img> recovery:
// logos, blank placeholders, share-card graphics, badges, banners, tiny icons. The semantic
// junk it CAN'T catch (a real photo of the wrong subject — a landmark, a plated steak, a
// website screenshot) is left to the vision stage (imageVision.classifyHotelImage / a local
// vision model). Precision over recall: better to pass a borderline image to vision than to
// wrongly reject a real photo here.
import sharp from "sharp";

// High-precision junk tokens in the filename/path. These almost never appear in a genuine
// room/exterior photo URL but are common in logos, share images, and placeholders.
// Tuned against real junk found in the catalog: fb.png, ogp.png, ogimg.jpg, dummy.png,
// ghost-100x70.png, bnr_contact.png, *_vector*, socialMediaFallbackImage, Webkachel_*.
const JUNK_URL = new RegExp(
  [
    "logo", "icon", "favicon", "sprite", "spacer", "pixel\\b", "loader",
    "placeholder", "\\bdummy\\b", "\\bghost\\b", "\\bblank\\b", "coming[-_]?soon",
    "no[-_]?image", "noimage", "default[-_]?(image|cover)", "fallback", "watermark",
    "\\bvector\\b", "badge", "\\bseal\\b", "award", "\\bbanner\\b", "\\bbnr\\b",
    "kachel", "\\bog[-_]?(p|img|image)\\b", "\\bogp\\b", "share[-_]?(img|image|card)",
    "social[-_]?media", "socialmedia", "\\bfb\\.(png|jpe?g)", "facebook", "\\btwitter\\b",
    "whatsapp", "qr[-_]?code", "\\bqrcode\\b", "screenshot", "\\bmap\\b", "floorplan",
    "floor[-_]?plan", "cookie", "consent", "gdpr", "payment", "\\bvisa\\b", "mastercard",
    "paypal", "coat[-_]?of[-_]?arms", "\\bemblem\\b", "\\bcrest\\b",
  ].join("|"),
  "i",
);

export type JunkVerdict = { junk: boolean; reason: string | null };

const NOT_JUNK: JunkVerdict = { junk: false, reason: null };

/** Filename/path heuristic — instant, no download. Use as a pre-filter before storing or fetching. */
export function junkByUrl(url: string): JunkVerdict {
  if (!url) return { junk: true, reason: "empty" };
  if (url.includes("placehold.co")) return { junk: true, reason: "placeholder-host" };
  if (/\.svg(\?|$)/i.test(url)) return { junk: true, reason: "svg" };
  const m = JUNK_URL.exec(url);
  return m ? { junk: true, reason: `url:${m[0].toLowerCase()}` } : NOT_JUNK;
}

// Thresholds tuned for PRECISION: real hotels publish small thumbnails (300x200 room crops),
// so the tiny-cutoff sits in clear icon/logo/button territory (flags, close buttons, webclips)
// and leaves ambiguous 200-300px squares to the vision stage. Better to pass a borderline
// image to vision than to wrongly hide a real room photo.
const MIN_W = 200; // below this is a flag/button/icon, not a photo
const MIN_H = 160;
const MAX_ASPECT = 4.0; // very wide → a banner strip
const MIN_ASPECT = 0.4; // very tall → a badge / vertical banner
const MIN_STDEV = 10; // near-uniform → a blank/solid placeholder

/**
 * Pixel heuristic — needs the image bytes. Catches tiny images, banner/badge aspect ratios,
 * and near-blank placeholders that have an innocent-looking filename. Returns junk:false on
 * any decode/measure error (let the vision stage decide rather than wrongly rejecting).
 */
export async function junkByImage(buf: Buffer): Promise<JunkVerdict> {
  try {
    const img = sharp(buf, { failOn: "none" });
    const meta = await img.metadata();
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (w && h) {
      if (w < MIN_W || h < MIN_H) return { junk: true, reason: `tiny:${w}x${h}` };
      const ar = w / h;
      if (ar > MAX_ASPECT) return { junk: true, reason: `wide:${ar.toFixed(1)}` };
      if (ar < MIN_ASPECT) return { junk: true, reason: `tall:${ar.toFixed(2)}` };
    }
    const stats = await img.stats();
    const maxStdev = Math.max(...stats.channels.slice(0, 3).map((c) => c.stdev));
    if (maxStdev < MIN_STDEV) return { junk: true, reason: `blank:${maxStdev.toFixed(1)}` };
    return NOT_JUNK;
  } catch {
    return NOT_JUNK; // can't measure → don't reject here; vision stage handles it
  }
}

/** Convenience: URL check first (free), then bytes if provided. */
export async function junkCheck(url: string, buf?: Buffer): Promise<JunkVerdict> {
  const byUrl = junkByUrl(url);
  if (byUrl.junk) return byUrl;
  return buf ? junkByImage(buf) : NOT_JUNK;
}

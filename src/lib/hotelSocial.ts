// Resolve a hotel's social handles from its OWN website (footer/header links). Free, no API
// key. Used to @mention featured hotels in published carousels so they repost → free reach.
// Resolved lazily for the handful of hotels we actually feature, then cached on `hotels`.
export type HotelSocial = { instagram: string | null; facebook: string | null; tiktok: string | null; threads: string | null };

const UA = "cosyhotels/1.0 (+https://cosyhotels.example; social resolver)";
const TIMEOUT = 8000;

// Non-account paths that share these domains — never a hotel's handle.
const IG_SKIP = /^(p|reel|reels|explore|stories|share|about|developer|directory|accounts|legal|tv|web)$/i;
const FB_SKIP = /^(sharer|share|dialog|tr|plugins|profile\.php|pages|groups|events|watch|help|policies|login|home\.php)$/i;
const TT_SKIP = /^(tag|music|discover|foryou|live|search|about|legal)$/i;
const TH_SKIP = /^(p|t|about|search|login|privacy|terms)$/i;

function clean(handle: string): string {
  return handle.replace(/[/?#].*$/, "").replace(/^@/, "").trim();
}

// Pull the first plausible account handle for a platform from raw HTML.
function extract(html: string, host: RegExp, skip: RegExp): string | null {
  const re = new RegExp(`https?://(?:www\\.|m\\.)?${host.source}/(@?[A-Za-z0-9_.-]+)`, "gi");
  for (const m of html.matchAll(re)) {
    const h = clean(m[1]);
    if (!h || h.length < 2 || skip.test(h)) continue;
    return h;
  }
  return null;
}

export async function resolveHotelSocial(website?: string | null): Promise<HotelSocial> {
  const empty: HotelSocial = { instagram: null, facebook: null, tiktok: null, threads: null };
  if (!website || !/^https?:\/\//i.test(website)) return empty;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(website, {
      headers: { "User-Agent": UA, accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return empty;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return empty;
    const html = await res.text();
    const instagram = extract(html, /instagram\.com/, IG_SKIP);
    // Threads shares Meta usernames — prefer an explicit threads.net link, else reuse the IG handle.
    const threads = extract(html, /threads\.(?:net|com)/, TH_SKIP) || instagram;
    return {
      instagram,
      facebook: extract(html, /facebook\.com/, FB_SKIP),
      tiktok: extract(html, /tiktok\.com/, TT_SKIP),
      threads,
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(id);
  }
}

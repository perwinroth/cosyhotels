// Search-engine URL submission. Both providers are gated on their credential env var and
// degrade gracefully (return an error tag, never throw) so callers/cron can keep going.
//
//   GOOGLE_SERVICE_ACCOUNT_JSON  — full service-account JSON (string). Indexing API.
//   BING_API_KEY                 — Bing Webmaster Tools API key.
//
// Caveat (documented for honesty): Google's Indexing API is officially supported only for
// JobPosting / BroadcastEvent pages; for ordinary pages it may accept the request but not
// act on it. Bing's URL submission works for any page. Sitemap.xml remains the primary
// discovery mechanism for Google.
import crypto from "crypto";

export type SubmitResult = { provider: "google" | "bing" | "indexnow"; submitted: number; errors: string[] };

// IndexNow (Bing/Yandex/Seznam/Naver). The key is public BY DESIGN — the protocol verifies
// ownership by fetching it back from /<key>.txt, so hardcoding it is not a secret leak.
export const INDEXNOW_KEY = "ccfa02a93fbd23e93591e19da6928868"; // served from public/<key>.txt

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function googleAccessToken(): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(raw);
  } catch {
    return null;
  }
  const email = sa.client_email;
  let key = sa.private_key;
  if (!email || !key) return null;
  key = String(key).replace(/\\n/g, "\n"); // env-escaped newlines → real PEM newlines

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/indexing",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  let signature: string;
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    signature = b64url(signer.sign(key));
  } catch {
    return null;
  }
  const jwt = `${header}.${claim}.${signature}`;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token || null;
  } catch {
    return null;
  }
}

export async function submitUrlsToGoogle(urls: string[]): Promise<SubmitResult> {
  const errors: string[] = [];
  if (!urls.length) return { provider: "google", submitted: 0, errors };
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return { provider: "google", submitted: 0, errors: ["no_key"] };
  const token = await googleAccessToken();
  if (!token) return { provider: "google", submitted: 0, errors: ["auth_failed"] };
  let submitted = 0;
  for (const url of urls) {
    try {
      const r = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: "URL_UPDATED" }),
      });
      if (r.ok) submitted++;
      else errors.push(`${r.status}`);
    } catch {
      errors.push("fetch_error");
    }
  }
  return { provider: "google", submitted, errors };
}

export async function submitUrlsToBing(urls: string[]): Promise<SubmitResult> {
  const errors: string[] = [];
  if (!urls.length) return { provider: "bing", submitted: 0, errors };
  const key = process.env.BING_API_KEY;
  if (!key) return { provider: "bing", submitted: 0, errors: ["no_key"] };
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.cosyhotelroom.com";
  try {
    const r = await fetch(`https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ siteUrl, urlList: urls }),
    });
    if (!r.ok) {
      // Surface the reason string — weeks of bare http_400 tags hid whether the failure was a
      // property mismatch, a dead key, or quota (see die-validation bing-channel finding 2026-07-09).
      const body = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      return { provider: "bing", submitted: 0, errors: [`http_${r.status}${body ? `:${body}` : ""}`] };
    }
    return { provider: "bing", submitted: urls.length, errors };
  } catch {
    return { provider: "bing", submitted: 0, errors: ["fetch_error"] };
  }
}

// IndexNow: one POST covers Bing + Yandex + Seznam + Naver; up to 10,000 URLs per call.
// Unlike the legacy Bing Webmaster API it needs no per-property API key — only the public
// key file this repo serves at /<INDEXNOW_KEY>.txt. All URLs must be on `host`.
export async function submitUrlsToIndexNow(urls: string[]): Promise<SubmitResult> {
  if (!urls.length) return { provider: "indexnow", submitted: 0, errors: [] };
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  let host: string;
  try {
    host = new URL(site).host;
  } catch {
    return { provider: "indexnow", submitted: 0, errors: ["bad_site_url"] };
  }
  const batch = urls.slice(0, 10000);
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${site}/${INDEXNOW_KEY}.txt`, urlList: batch }),
    });
    if (!r.ok) {
      const body = (await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160);
      return { provider: "indexnow", submitted: 0, errors: [`http_${r.status}${body ? `:${body}` : ""}`] };
    }
    return { provider: "indexnow", submitted: batch.length, errors: [] };
  } catch {
    return { provider: "indexnow", submitted: 0, errors: ["fetch_error"] };
  }
}

// Submit to all providers; returns flat tags suitable for a growth_log errors[] column.
export async function submitUrls(urls: string[]): Promise<string[]> {
  const tags: string[] = [];
  const [g, b, x] = await Promise.all([submitUrlsToGoogle(urls), submitUrlsToBing(urls), submitUrlsToIndexNow(urls)]);
  tags.push(`google_submitted:${g.submitted}`);
  if (g.errors.length) tags.push(`google_errors:${g.errors.join("|")}`);
  tags.push(`bing_submitted:${b.submitted}`);
  if (b.errors.length) tags.push(`bing_errors:${b.errors.join("|")}`);
  tags.push(`indexnow_submitted:${x.submitted}`);
  if (x.errors.length) tags.push(`indexnow_errors:${x.errors.join("|")}`);
  return tags;
}

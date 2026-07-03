// Google Search Console read client. Authenticates as the service account (JWT → OAuth token, no
// SDK dependency) and queries the Search Analytics API. Powers the KPI panel in /growth.
// Env: GSC_SA_EMAIL, GSC_SA_PRIVATE_KEY (the -----BEGIN PRIVATE KEY----- block; literal \n tolerated),
//      GSC_PROPERTY (optional; defaults to the sc-domain: property for a DNS-verified domain).
import crypto from "node:crypto";
import { cache } from "react";

const PROPERTY = process.env.GSC_PROPERTY || "sc-domain:gotcosy.com";
const b64url = (b: crypto.BinaryLike) => Buffer.from(b as Buffer).toString("base64url");

export function gscConfigured(): boolean {
  return Boolean(process.env.GSC_SA_EMAIL && process.env.GSC_SA_PRIVATE_KEY);
}

// Mint a short-lived access token from the SA key. cache()'d so multiple queries in one render reuse it.
const getToken = cache(async (): Promise<string | null> => {
  const email = process.env.GSC_SA_EMAIL;
  const key = (process.env.GSC_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  try {
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    const jwt = `${header}.${claim}.${b64url(signer.sign(key))}`;
    const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
    const j = await res.json();
    return j.access_token || null;
  } catch { return null; }
});

export type GscRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

// Raw Search Analytics query. `dimensions: []` returns a single totals row.
export async function gscQuery(body: { startDate: string; endDate: string; dimensions?: string[]; rowLimit?: number }): Promise<GscRow[] | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
      method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return (j.rows || []) as GscRow[];
  } catch { return null; }
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// The /growth KPI bundle: 28-day totals + top queries + top pages (GSC lags ~2 days, so end 2 days back).
export const getGscSummary = cache(async () => {
  if (!gscConfigured()) return null;
  const end = new Date(Date.now() - 2 * 86_400_000);
  const start = new Date(end.getTime() - 27 * 86_400_000);
  const range = { startDate: ymd(start), endDate: ymd(end) };
  const [totalsRows, queries, pages] = await Promise.all([
    gscQuery({ ...range, dimensions: [] }),
    gscQuery({ ...range, dimensions: ["query"], rowLimit: 12 }),
    gscQuery({ ...range, dimensions: ["page"], rowLimit: 12 }),
  ]);
  if (totalsRows === null && queries === null && pages === null) return null; // auth/permission failure
  const totals = totalsRows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return { range, totals, queries: queries || [], pages: pages || [] };
});

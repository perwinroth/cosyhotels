// DIE measurement cron — weekly GSC snapshot, treated (Bruges/Charleston) vs control (York/Savannah).
// Runs inside Vercel where GSC_SA_EMAIL/GSC_SA_PRIVATE_KEY (Sensitive) are available at runtime, so no
// key ever leaves Vercel. Writes one row to public.gsc_measurements (readonly GSC; no truth data touched).
// die-validation pulls the rows via scripts/measure-fetch.mjs into its measurement graph.
//
//   GET /api/cron/measure-gsc            snapshot last 28d
//        ?days=90                        custom window
// Auth: if CRON_SECRET is set, requires `Authorization: Bearer <CRON_SECRET>` (Vercel sends it on cron).
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const maxDuration = 120;
export const revalidate = 0;

const MARKETS: Record<string, { arm: string; match: string[] }> = {
  "bruges (treated)": { arm: "treated", match: ["/bruges", "brugge"] },
  "charleston (treated)": { arm: "treated", match: ["/charleston", "charleston-historic"] },
  "york (control)": { arm: "control", match: ["/york"] },
  "savannah (control)": { arm: "control", match: ["/savannah"] },
};
const DIE_URLS = [
  "/en/guides/cosy-hotels-near-bruges-christmas-market",
  "/en/guides/bruges-vs-ghent-cosy-weekend",
  "/en/cosy-hotels/quiet/bruges",
  "/en/guides/cosy-hotels-charleston-historic-district",
];

type Row = { keys: string[]; clicks: number; impressions: number; position?: number };
const sum = (rows: Row[]) => rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const email = process.env.GSC_SA_EMAIL;
  const key = (process.env.GSC_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !key) return NextResponse.json({ error: "GSC_SA_EMAIL/PRIVATE_KEY not set" }, { status: 500 });
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const days = Math.min(180, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 28));

  // Service-account JWT → access token (webmasters.readonly).
  const b64url = (b: crypto.BinaryLike) => Buffer.from(b).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const signer = crypto.createSign("RSA-SHA256"); signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(key))}`;
  const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) }).then((r) => r.json());
  if (!tok.access_token) return NextResponse.json({ error: "GSC token exchange failed" }, { status: 502 });

  const end = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  const start = new Date(Date.now() - (days + 1) * 86_400_000).toISOString().slice(0, 10);
  const PROP = process.env.GSC_PROPERTY || "sc-domain:gotcosy.com";
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROP)}/searchAnalytics/query`, {
    method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["page"], rowLimit: 5000 }),
  });
  if (!r.ok) return NextResponse.json({ error: `GSC HTTP ${r.status}` }, { status: 502 });
  const pageRows: Row[] = (await r.json()).rows || [];

  const by_market: Record<string, unknown> = {};
  for (const [name, cfg] of Object.entries(MARKETS)) {
    const rows = pageRows.filter((x) => cfg.match.some((m) => x.keys[0].toLowerCase().includes(m)));
    const s = sum(rows);
    by_market[name] = { arm: cfg.arm, pages: rows.length, clicks: s.clicks, impressions: s.impressions };
  }
  const die_urls = DIE_URLS.map((u) => {
    const row = pageRows.find((x) => x.keys[0].includes(u));
    return { url: u, clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0, position: row?.position ?? null, indexed: !!row };
  });
  const site = sum(pageRows);
  const snapshot = { measured_at: end, window_days: days, window: `${start}..${end}`, property: PROP, site_total: site, by_market, die_urls };

  // Upsert on measured_at so re-runs in the same window overwrite rather than duplicate.
  const { error } = await db.from("gsc_measurements").upsert(
    { measured_at: end, window_days: days, site_clicks: site.clicks, site_impressions: site.impressions, by_market, die_urls, snapshot },
    { onConflict: "measured_at" },
  );
  if (error) return NextResponse.json({ error: `insert failed: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, measured_at: end, site, by_market, die_urls });
}

#!/usr/bin/env node
// One-off research: pull real GSC search-query demand and bucket it by geographic intent
// (country names vs region/area names vs city) to size a country/region search feature.
//   node --env-file=.env.local scripts/geo-demand-scan.mjs
// Read-only. No writes.
import crypto from "node:crypto";

const email = process.env.GSC_SA_EMAIL;
const key = (process.env.GSC_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!email || !key) { console.error("✗ missing GSC_SA_* in .env.local"); process.exit(1); }
const PROPERTY = process.env.GSC_PROPERTY || "sc-domain:gotcosy.com";

const b64url = (b) => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claim = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
const signer = crypto.createSign("RSA-SHA256"); signer.update(`${header}.${claim}`);
const jwt = `${header}.${claim}.${b64url(signer.sign(key))}`;
const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) }).then((r) => r.json());
if (!tok.access_token) { console.error("✗ token exchange failed:", JSON.stringify(tok)); process.exit(1); }

const ymd = (d) => d.toISOString().slice(0, 10);
const end = new Date(Date.now() - 2 * 86_400_000);
const start = new Date(end.getTime() - 89 * 86_400_000);
const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
  method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
  body: JSON.stringify({ startDate: ymd(start), endDate: ymd(end), dimensions: ["query"], rowLimit: 5000 }),
});
const j = await res.json();
const rows = (j.rows || []).map((r) => ({ q: r.keys[0], clicks: r.clicks, impr: r.impressions }));
console.log(`GSC 90d (${ymd(start)}→${ymd(end)}): ${rows.length} distinct queries, ${rows.reduce((a, b) => a + b.impr, 0)} impressions total\n`);

// Famous travel REGIONS/AREAS (not cities, not countries) — the "amalfi coast" class.
const REGIONS = ["amalfi coast", "amalfi", "tuscany", "cotswolds", "lake district", "provence", "cinque terre",
  "algarve", "andalusia", "andalucia", "costa brava", "dolomites", "bavaria", "black forest", "loire valley",
  "dordogne", "peak district", "scottish highlands", "highlands", "snowdonia", "yorkshire dales", "cornwall",
  "santorini", "tyrol", "alsace", "puglia", "sicily", "sardinia", "umbria", "chianti", "cape cod", "napa",
  "douro", "veneto", "provence", "champagne", "burgundy", "normandy", "brittany", "catalonia", "basque",
  "costa del sol", "kerry", "connemara", "wales", "bordeaux region"];
const COUNTRIES = ["italy", "france", "spain", "portugal", "germany", "greece", "england", "scotland", "ireland",
  "uk", "united kingdom", "switzerland", "austria", "croatia", "netherlands", "belgium", "iceland", "norway",
  "sweden", "denmark", "japan", "morocco", "usa", "united states", "canada", "australia", "turkey", "slovenia",
  "czech", "czechia", "poland", "hungary", "thailand", "vietnam", "indonesia", "bali"];

const bucket = (terms) => {
  const hits = [];
  for (const t of terms) {
    const m = rows.filter((r) => new RegExp(`(^|\\b)${t.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\b|s?$| )`, "i").test(r.q));
    const impr = m.reduce((a, b) => a + b.impr, 0), clicks = m.reduce((a, b) => a + b.clicks, 0);
    if (impr > 0) hits.push({ t, impr, clicks, n: m.length, ex: m.sort((a, b) => b.impr - a.impr).slice(0, 3).map((x) => x.q) });
  }
  return hits.sort((a, b) => b.impr - a.impr);
};

const showBucket = (label, hits) => {
  console.log(`\n===== ${label} =====`);
  if (!hits.length) { console.log("  (no impressions)"); return; }
  for (const h of hits) console.log(`  ${String(h.impr).padStart(5)} impr  ${String(h.clicks).padStart(3)} clk  [${h.n}]  ${h.t}  ·  ${h.ex.join(" | ")}`);
};

showBucket("REGION / AREA demand (amalfi-coast class)", bucket(REGIONS));
showBucket("COUNTRY demand", bucket(COUNTRIES));

// Top 40 raw queries for eyeballing
console.log(`\n===== TOP 40 QUERIES BY IMPRESSIONS =====`);
rows.sort((a, b) => b.impr - a.impr).slice(0, 40).forEach((r) => console.log(`  ${String(r.impr).padStart(5)}  ${String(r.clicks).padStart(3)}  ${r.q}`));

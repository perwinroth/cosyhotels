#!/usr/bin/env node
// Verify the Google Search Console service-account setup end to end.
//   node --env-file=.env.local scripts/gsc-test.mjs
// Needs GSC_SA_EMAIL + GSC_SA_PRIVATE_KEY in .env.local. Prints auth status, which property form
// the SA can read, and a sample of 28-day data. No writes.
import crypto from "node:crypto";

const email = process.env.GSC_SA_EMAIL;
const key = (process.env.GSC_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n");
if (!email || !key) { console.error("✗ missing GSC_SA_EMAIL and/or GSC_SA_PRIVATE_KEY in .env.local"); process.exit(1); }
console.log("SA email:", email);

const b64url = (b) => Buffer.from(b).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const claim = b64url(JSON.stringify({ iss: email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
const signer = crypto.createSign("RSA-SHA256"); signer.update(`${header}.${claim}`);
let jwt;
try { jwt = `${header}.${claim}.${b64url(signer.sign(key))}`; }
catch (e) { console.error("✗ could not sign JWT — the private key looks malformed:", e.message); process.exit(1); }

const tok = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) }).then((r) => r.json());
if (!tok.access_token) { console.error("✗ token exchange failed:", JSON.stringify(tok)); process.exit(1); }
console.log("✓ authenticated (got access token)\n");

// Which properties can this SA see?
const list = await fetch("https://searchconsole.googleapis.com/webmasters/v3/sites", { headers: { authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
const sites = (list.siteEntry || []).map((s) => `${s.siteUrl} (${s.permissionLevel})`);
console.log("Properties the SA can access:", sites.length ? "\n  " + sites.join("\n  ") : "NONE — do step 5: add the SA email as a user on the gotcosy.com property in Search Console.");

const end = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const start = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
for (const prop of ["sc-domain:gotcosy.com", "https://gotcosy.com/"]) {
  const r = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`, {
    method: "POST", headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: start, endDate: end, dimensions: [] }),
  });
  if (!r.ok) { console.log(`\n${prop} → HTTP ${r.status} (no access / not this property form)`); continue; }
  const j = await r.json();
  const t = j.rows?.[0];
  console.log(`\n✓ ${prop} → ${t ? `${t.clicks} clicks · ${t.impressions} impressions · pos ${t.position?.toFixed(1)} (last 28d)` : "reachable but no data yet (normal for a new/unsubmitted site)"}`);
  console.log(`   → set GSC_PROPERTY="${prop}" in Vercel if it differs from the default (sc-domain:gotcosy.com).`);
}

#!/usr/bin/env node
// Reddit lead-finder (WP5). Surfaces threads where people ask for cosy/boutique hotel recommendations
// in cities we cover, via Apify's Google-search actor (site:reddit.com …) — which dodges Reddit's
// API/IP block and needs no Reddit credentials. Writes new rows to reddit_leads; Per replies MANUALLY
// from /growth (ban-safe: we NEVER auto-post to Reddit).
//
// Usage:
//   node --env-file=.env.local scripts/find-reddit-threads.mjs               # DRY-RUN (sample cities, no DB writes)
//   node --env-file=.env.local scripts/find-reddit-threads.mjs --limit 10    # dry-run, 10 cities
//   node --env-file=.env.local scripts/find-reddit-threads.mjs --execute     # all cities, insert new leads
import { createClient } from "@supabase/supabase-js";

const TOKEN = process.env.APIFY_TOKEN;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!TOKEN) { console.error("✗ need APIFY_TOKEN"); process.exit(1); }
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);

const EXECUTE = process.argv.includes("--execute");
const li = process.argv.indexOf("--limit");
const LIMIT = li >= 0 ? parseInt(process.argv[li + 1], 10) : (EXECUTE ? 99 : 4);
const ACTOR = "apify~google-search-scraper";

// Cities we have guide pages for (from src/data/cityGuides.ts) — leads for these are the most
// actionable because we can reply with a real ranked guide link.
const CITIES = ["Paris", "Edinburgh", "Amsterdam", "Prague", "Bruges", "Venice", "Florence", "Barcelona",
  "Copenhagen", "Santorini", "New York City", "San Francisco", "Charleston", "Savannah", "Quebec City",
  "Kyoto", "Ubud", "Queenstown", "Sydney", "Tokyo", "Reykjavik", "Lucerne", "Salzburg", "Porto", "Dubrovnik"];

const queryFor = (city) => `site:reddit.com cosy OR boutique OR "where to stay" hotel recommendation ${city}`;
// A result is a lead if it's a real thread AND the title reads like a request, not an article/promo.
const THREAD_RE = /reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)\//i;
const REQUEST_RE = /recommend|where to stay|looking for|suggestion|best|worth|advice|help|any (good|nice)|\?/i;
const NOISE_RE = /lego|minecraft|for sale|selling|my (photos|trip report)/i;

async function runActor(queries) {
  const input = { queries: queries.join("\n"), maxPagesPerQuery: 1, resultsPerPage: 10, countryCode: "us", languageCode: "en", saveHtml: false, saveHtmlToKeyValueStore: false };
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }).then((r) => r.json());
  const runId = start?.data?.id, dsId = start?.data?.defaultDatasetId;
  if (!runId) throw new Error("actor start failed: " + JSON.stringify(start).slice(0, 200));
  let run, tries = 0;
  do { await new Promise((r) => setTimeout(r, 4000)); run = (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`).then((r) => r.json()))?.data; tries++; } while (run && ["READY", "RUNNING"].includes(run.status) && tries < 40);
  const items = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${TOKEN}&clean=true`).then((r) => r.json());
  return { items: items || [], costUsd: run?.usageTotalUsd ?? 0, status: run?.status };
}

(async () => {
  const cities = CITIES.slice(0, LIMIT);
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${cities.length} cities · actor ${ACTOR}`);
  const queries = cities.map(queryFor);
  const { items, costUsd, status } = await runActor(queries);
  console.log(`actor ${status} · $${Number(costUsd).toFixed(4)} · ${items.length} query results\n`);

  // Map each dataset item (one per query) back to its city, collect leads.
  const leads = new Map(); // id -> lead
  for (const it of items) {
    const q = it.searchQuery?.term || it.searchQuery || "";
    const city = cities.find((c) => String(q).includes(c)) || "";
    for (const o of it.organicResults || []) {
      const m = THREAD_RE.exec(o.url || "");
      if (!m) continue;
      const title = (o.title || "").replace(/\s*:\s*r\/\w+\s*$/i, "").trim();
      if (NOISE_RE.test(title) || !REQUEST_RE.test(title)) continue;
      const id = m[2];
      if (!leads.has(id)) leads.set(id, { id, subreddit: m[1], title, url: (o.url || "").split("?")[0], snippet: (o.description || o.snippet || "").slice(0, 400), query: String(q), city });
    }
  }
  const found = [...leads.values()];
  console.log(`${found.length} candidate leads:`);
  for (const l of found) console.log(`  [${l.city}] r/${l.subreddit} — ${l.title.slice(0, 70)}`);

  if (!EXECUTE) { console.log("\nDRY-RUN — no DB writes. Re-run with --execute to insert new leads."); return; }
  if (!found.length) { console.log("\nnothing to insert."); return; }
  const { data: existing } = await db.from("reddit_leads").select("id").in("id", found.map((l) => l.id));
  const have = new Set((existing || []).map((r) => r.id));
  const fresh = found.filter((l) => !have.has(l.id));
  if (!fresh.length) { console.log("\nall already in reddit_leads — 0 new."); return; }
  const { error } = await db.from("reddit_leads").insert(fresh);
  if (error) { console.error("insert failed:", error.message); process.exit(1); }
  console.log(`\n✓ inserted ${fresh.length} new leads (${found.length - fresh.length} already known).`);
})();

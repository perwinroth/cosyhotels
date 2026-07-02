// Unified review scraping done RIGHT. The old script handed Apify a Google Maps *search* URL per
// hotel, so the actor searched + scraped reviews from every candidate place and we kept one — paying
// for many places per hotel (proxy-heavy). This version:
//   1. resolves each hotel to ONE exact place_id via the Google Places API (IDs-only Text Search =
//      free SKU — no charge), and
//   2. scrapes 10 reviews for THAT place only via Apify (exact place URLs, no search, no waste),
//      reading the REAL cost from each run's usageTotalUsd (the true Apify bill, not a guess).
//   node --env-file=.env.local scripts/scrape-reviews-google-apify.mjs --limit 30 --execute   # pilot
//   node --env-file=.env.local scripts/scrape-reviews-google-apify.mjs --execute              # full set
//   flags: --min-score 5  --limit N  --reviews 10  --batch 80  --execute
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 5));
const LIMIT = Number(flag("--limit", 0)) || 0;
const REVIEWS = Number(flag("--reviews", 10));
const BATCH = Number(flag("--batch", 80));
const TOKEN = process.env.APIFY_TOKEN;
const GKEY = process.env.GOOGLE_MAPS_API_KEY;
const ACTOR = "compass~google-maps-reviews-scraper";
const CACHE = "scripts/backups/review-cache.json";
const PIDC = "scripts/backups/place-id-cache.json";
const PROGRESS = "scripts/backups/apify-scrape-progress.json";
if (!TOKEN || !GKEY) { console.error("✗ need APIFY_TOKEN + GOOGLE_MAPS_API_KEY"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const pidCache = existsSync(PIDC) ? JSON.parse(readFileSync(PIDC, "utf8")) : {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
function overlap(a, b) { const ta = tokens(a), tb = tokens(b); if (!ta.size) return 0; let n = 0; for (const t of ta) if (tb.has(t)) n++; return n / ta.size; }

// ---- hotels needing reviews -----------------------------------------------------------------------
const need = [];
for (let off = 0; ; off += 1000) {
  const { data } = await db.from("cosy_scores").select("hotel_id, hotel:hotel_id!inner(name,name_en,city,country)").gte("score", MIN).order("score", { ascending: false }).range(off, off + 999);
  if (!data?.length) break;
  for (const r of data) {
    const id = String(r.hotel_id);
    if (cache[id] && cache[id].length) continue;
    const name = (r.hotel?.name_en || r.hotel?.name || "").trim();
    if (name) need.push({ hotel_id: id, name, city: r.hotel?.city || "", country: r.hotel?.country || "" });
  }
  if (data.length < 1000) break;
  if (LIMIT && need.length >= LIMIT * 1.2) break;
}
const work = LIMIT ? need.slice(0, LIMIT) : need;
console.log(`${work.length} hotels need reviews (score>=${MIN}) · ${REVIEWS} reviews each · Google place lookup (free IDs-only) + Apify reviews · ${EXECUTE ? "EXECUTE" : "DRY-RUN"}`);
if (!work.length) { console.log("nothing to do."); process.exit(0); }
if (!EXECUTE) { for (const h of work.slice(0, 10)) console.log(`  • ${h.name} — ${[h.city, h.country].filter(Boolean).join(", ")}`); console.log("\nDRY-RUN — no spend. Add --execute (use --limit for a pilot)."); process.exit(0); }

// ---- resolve place_ids via Google (free IDs-only Text Search), small concurrency ------------------
let gCalls = 0, gHits = 0;
async function resolve(h) {
  if (pidCache[h.hotel_id] !== undefined) return pidCache[h.hotel_id];
  const q = [h.name, h.city, h.country].filter(Boolean).join(" ");
  try {
    gCalls++;
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GKEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress" }, body: JSON.stringify({ textQuery: q, maxResultCount: 1 }) }).then((r) => r.json());
    const p = r?.places?.[0] || null;
    const out = p ? { id: p.id, title: p.displayName?.text || "", address: p.formattedAddress || "" } : null;
    if (out) gHits++;
    pidCache[h.hotel_id] = out;
    return out;
  } catch { pidCache[h.hotel_id] = null; return null; }
}

// ---- Apify reviews for exact places; return items + REAL cost -------------------------------------
async function runActor(places) {
  const startUrls = places.map((p) => ({ url: `https://www.google.com/maps/place/?q=place_id:${p.pid.id}` }));
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ startUrls, maxReviews: REVIEWS, language: "en", reviewsSort: "newest", personalData: false }) }).then((r) => r.json());
  const runId = start?.data?.id, dsId = start?.data?.defaultDatasetId;
  if (!runId) throw new Error("run not started: " + JSON.stringify(start).slice(0, 200));
  let run;
  for (let i = 0; i < 360; i++) {
    await sleep(5000);
    run = (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`).then((r) => r.json()))?.data;
    if (run?.status === "SUCCEEDED") break;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run?.status)) throw new Error("run " + run.status);
  }
  const items = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${TOKEN}&clean=true&limit=100000`).then((r) => r.json());
  return { items: Array.isArray(items) ? items : [], costUsd: Number(run?.usageTotalUsd || 0) };
}

let scraped = 0, matched = 0, noMatch = 0, noPlace = 0, totalReviews = 0, realCost = 0;
const startedAt = Date.now(); const recent = [];
const writeProgress = (extra = {}) => { try { writeFileSync(PROGRESS, JSON.stringify({ job: "scrape", method: "google+apify", total: work.length, done: scraped, matched, noMatch, noPlace, reviews: totalReviews, costUsd: +realCost.toFixed(4), googleCalls: gCalls, reviewsEach: REVIEWS, perHotelUsd: scraped ? +(realCost / scraped).toFixed(5) : 0, projectedFullUsd: scraped ? +((realCost / scraped) * need.length).toFixed(2) : 0, startedAt, updatedAt: Date.now(), recent: recent.slice(-10).reverse(), ...extra }, null, 2)); } catch {} };
writeProgress();

for (let b = 0; b < work.length; b += BATCH) {
  const batch = work.slice(b, b + BATCH);
  // 1) resolve place_ids (concurrency 10)
  const withPid = [];
  for (let i = 0; i < batch.length; i += 10) {
    const chunk = batch.slice(i, i + 10);
    const pids = await Promise.all(chunk.map(resolve));
    chunk.forEach((h, j) => { if (pids[j]?.id) withPid.push({ h, pid: pids[j] }); else { noPlace++; recent.push({ name: h.name, city: h.city, reviews: 0, note: "no place" }); } });
  }
  writeFileSync(PIDC, JSON.stringify(pidCache));
  if (!withPid.length) { scraped += batch.length; writeProgress(); continue; }
  // 2) scrape reviews for those exact places
  let items = [], cost = 0;
  try { ({ items, costUsd: cost } = await runActor(withPid)); } catch (e) { console.log(`batch ${b}: actor error — ${String(e.message).slice(0, 90)}`); continue; }
  realCost += cost;
  // group returned reviews by placeId
  const byPid = new Map();
  for (const it of items) {
    const pid = it.placeId || ""; if (!pid) continue;
    if (!byPid.has(pid)) byPid.set(pid, { title: it.title || it.name || "", address: it.address || "", texts: [] });
    const t = (it.text || it.textTranslated || "").trim(); if (t) byPid.get(pid).texts.push(t);
  }
  for (const { h, pid } of withPid) {
    const g = byPid.get(pid.id);
    // exact place_id match; light title guard against the rare actor mismatch
    if (g && g.texts.length && (overlap(h.name, g.title) >= 0.34 || overlap(pid.title, g.title) >= 0.5)) {
      cache[h.hotel_id] = g.texts.slice(0, REVIEWS); matched++; totalReviews += cache[h.hotel_id].length;
      recent.push({ name: h.name, city: h.city, reviews: cache[h.hotel_id].length });
    } else { noMatch++; recent.push({ name: h.name, city: h.city, reviews: 0 }); }
  }
  scraped += batch.length;
  writeFileSync(CACHE, JSON.stringify(cache, null, 0));
  writeProgress();
  console.log(`batch ${b + batch.length}/${work.length}  matched ${matched} · noMatch ${noMatch} · noPlace ${noPlace} · reviews ${totalReviews} · REAL cost $${realCost.toFixed(4)} ($${(realCost / Math.max(scraped, 1)).toFixed(5)}/hotel → full ~$${((realCost / Math.max(scraped, 1)) * need.length).toFixed(2)})`);
}
writeProgress({ finished: true });
console.log(`\ndone — ${matched}/${scraped} got reviews · ${totalReviews} reviews · Google calls ${gCalls} (free IDs-only) · REAL Apify cost $${realCost.toFixed(4)} · $${(realCost / Math.max(scraped, 1)).toFixed(5)}/hotel`);

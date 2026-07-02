// Scrape ~10 Google Maps guest reviews per hotel via Apify (compass/google-maps-reviews-scraper)
// for shown hotels that don't yet have cached reviews, and append them to review-cache.json — the
// same cache that powers generate-faqs.mjs, generate-copy.mjs and review scoring. $0.0003/review →
// ~$0.003/hotel (10 reviews); the Apify FREE plan's $5/mo credit covers ~1,600 hotels.
//
//   node --env-file=.env.local scripts/scrape-reviews-apify.mjs                  # dry-run: scope + cost
//   node --env-file=.env.local scripts/scrape-reviews-apify.mjs --limit 20 --execute   # pilot 20
//   node --env-file=.env.local scripts/scrape-reviews-apify.mjs --execute        # full (needs credit)
//   flags: --min-score 5  --limit N  --reviews 10  --batch 40  --execute
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 5));
const LIMIT = Number(flag("--limit", 0)) || 0;
const REVIEWS = Number(flag("--reviews", 10));
const BATCH = Number(flag("--batch", 40));
const COST_PER_REVIEW = 0.0003;
const TOKEN = process.env.APIFY_TOKEN;
const ACTOR = "compass~google-maps-reviews-scraper";
const CACHE = "scripts/backups/review-cache.json";
const PROGRESS = "scripts/backups/apify-scrape-progress.json"; // read by scripts/pipeline-monitor.mjs

if (!TOKEN) { console.error("✗ APIFY_TOKEN not set"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
function overlap(a, b) { const ta = tokens(a), tb = tokens(b); if (!ta.size) return 0; let n = 0; for (const t of ta) if (tb.has(t)) n++; return n / ta.size; }

// ---- gather hotels needing reviews ---------------------------------------------------------------
const need = [];
for (let off = 0; ; off += 1000) {
  const { data } = await db.from("cosy_scores").select("hotel_id, hotel:hotel_id!inner(name,name_en,city,country)").gte("score", MIN).order("score", { ascending: false }).range(off, off + 999);
  if (!data?.length) break;
  for (const r of data) {
    const id = String(r.hotel_id);
    if (cache[id] && cache[id].length) continue; // already have reviews
    const name = (r.hotel?.name_en || r.hotel?.name || "").trim();
    if (!name) continue;
    need.push({ hotel_id: id, name, city: r.hotel?.city || "", country: r.hotel?.country || "" });
  }
  if (data.length < 1000) break;
  if (LIMIT && need.length >= LIMIT * 1.2) break;
}
const work = LIMIT ? need.slice(0, LIMIT) : need;
console.log(`${work.length} shown hotels need reviews (score>=${MIN}, not cached) · ${REVIEWS} reviews each · est ≤ $${(work.length * REVIEWS * COST_PER_REVIEW).toFixed(2)} · ${EXECUTE ? "EXECUTE" : "DRY-RUN"}\n`);
if (!work.length) { console.log("nothing to do."); process.exit(0); }
if (!EXECUTE) {
  console.log("DRY-RUN — no Apify calls, no spend. Sample of hotels that WOULD be scraped:");
  for (const h of work.slice(0, 10)) console.log(`  • ${h.name} — ${[h.city, h.country].filter(Boolean).join(", ")}`);
  console.log(`\nFREE $5/mo credit covers ~${Math.floor(5 / (REVIEWS * COST_PER_REVIEW))} hotels. Re-run with --execute (use --limit to cap).`);
  process.exit(0);
}

// ---- run the Apify actor for a batch and return dataset items ------------------------------------
async function runActor(startUrls) {
  const start = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ startUrls, maxReviews: REVIEWS, language: "en", reviewsSort: "newest", personalData: false }),
  }).then((r) => r.json());
  const runId = start?.data?.id, dsId = start?.data?.defaultDatasetId;
  if (!runId) throw new Error("run not started: " + JSON.stringify(start).slice(0, 200));
  // poll until finished — update live review count each tick so the progress bar moves mid-batch
  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`).then((r) => r.json());
    const status = st?.data?.status;
    try { const ds = await fetch(`https://api.apify.com/v2/datasets/${dsId}?token=${TOKEN}`).then((r) => r.json()); liveBatch = ds?.data?.itemCount || liveBatch; writeProgress(); } catch {}
    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") throw new Error("run " + status);
  }
  const items = await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${TOKEN}&clean=true&limit=100000`).then((r) => r.json());
  return Array.isArray(items) ? items : [];
}

let scraped = 0, matched = 0, noMatch = 0, totalReviews = 0, liveBatch = 0;
const startedAt = Date.now();
const recent = [];
const writeProgress = (extra = {}) => { try {
  const reviews = totalReviews + liveBatch;
  writeFileSync(PROGRESS, JSON.stringify({ job: "scrape", total: work.length, done: scraped + Math.floor(liveBatch / REVIEWS), matched, noMatch, reviews, costUsd: +(reviews * COST_PER_REVIEW).toFixed(2), reviewsEach: REVIEWS, startedAt, updatedAt: Date.now(), recent: recent.slice(-10).reverse(), ...extra }, null, 2));
} catch {} };
writeProgress();
for (let b = 0; b < work.length; b += BATCH) {
  const batch = work.slice(b, b + BATCH);
  const startUrls = batch.map((h) => ({ url: `https://www.google.com/maps/search/${encodeURIComponent(`${h.name} ${h.city}`)}` }));
  let items = [];
  try { items = await runActor(startUrls); } catch (e) { console.log(`batch ${b}-${b + batch.length}: actor error — ${String(e.message).slice(0, 80)}`); continue; }
  scraped += batch.length;
  // group reviews by placeId
  const byPlace = new Map();
  for (const it of items) {
    const pid = it.placeId || it.title || "";
    if (!pid) continue;
    if (!byPlace.has(pid)) byPlace.set(pid, { title: it.title || it.name || "", address: it.address || "", texts: [] });
    const t = (it.text || it.textTranslated || "").trim();
    if (t) byPlace.get(pid).texts.push(t);
  }
  // assign each placeId-group to the best-matching hotel in the batch (guards against wrong place)
  for (const h of batch) {
    let best = null, bestScore = 0;
    for (const g of byPlace.values()) {
      const s = Math.max(overlap(h.name, g.title), 0.6 * overlap(`${h.name} ${h.city}`, `${g.title} ${g.address}`));
      if (s > bestScore) { bestScore = s; best = g; }
    }
    if (best && bestScore >= 0.5 && best.texts.length) {
      cache[h.hotel_id] = best.texts.slice(0, REVIEWS);
      matched++; totalReviews += cache[h.hotel_id].length;
      recent.push({ name: h.name, city: h.city, reviews: cache[h.hotel_id].length });
    } else { noMatch++; recent.push({ name: h.name, city: h.city, reviews: 0 }); }
  }
  liveBatch = 0; // batch committed into totalReviews now; clear the live counter
  writeFileSync(CACHE, JSON.stringify(cache, null, 0)); // incremental, crash-safe
  writeProgress();
  console.log(`batch ${b + batch.length}/${work.length}  matched ${matched} · no-match ${noMatch} · reviews ${totalReviews} · ~$${(totalReviews * COST_PER_REVIEW).toFixed(2)}`);
}
writeProgress({ finished: true });
console.log(`\ndone — ${matched}/${scraped} hotels got reviews (${noMatch} no confident match) · ${totalReviews} reviews cached → ${CACHE} · ~$${(totalReviews * COST_PER_REVIEW).toFixed(2)}`);

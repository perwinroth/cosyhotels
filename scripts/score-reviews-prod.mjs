#!/usr/bin/env node
// PRODUCTION review-scoring: for un-grounded shown hotels (score>=MIN, no usable photo), fetch ~20
// guest reviews (1 Serper page = 2 calls), score cosiness with Claude Haiku, calibrate to the owner
// grades, and write the result to cosy_scores. Highest-score-first so a partial budget covers the
// most-visible hotels. DRY-RUN by default; --execute writes (every prior score is backed up first).
//   node --env-file=.env.local scripts/score-reviews-prod.mjs                 # dry-run (no writes/spend on review fetch? it DOES fetch)
//   node --env-file=.env.local scripts/score-reviews-prod.mjs --execute       # real run
//   flags: --min 5  --limit 100000
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min", 5));
const LIMIT = Number(flag("--limit", 100000));
const SERPER = process.env.SERPER_KEY, ANTHRO = process.env.ANTHROPIC_API_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!SERPER || !ANTHRO) { console.error("✗ need SERPER_KEY and ANTHROPIC_API_KEY"); process.exit(1); }
const STATE = "scripts/backups/review-scoring-state.json";
const BACKUP = "scripts/backups/review-scoring-backup.jsonl";
const CACHE = "scripts/backups/review-cache.json";
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// ---- calibration: map Haiku's 0-10 onto the owner-grade scale (fixes the absolute offset) ----
let calA = 1, calB = 0;
try {
  const extra = JSON.parse(readFileSync("scripts/backups/bakeoff-extra.json", "utf8"));
  const bo = JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8"));
  const pairs = bo.filter((r) => extra[r.id]?.h20 != null && typeof r.grade === "number").map((r) => [extra[r.id].h20, r.grade]);
  if (pairs.length >= 15) { const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0); calA = (n * sxy - sx * sy) / (n * sxx - sx * sx); calB = (sy - calA * sx) / n; console.log(`calibration from ${n} graded: grade ≈ ${calA.toFixed(2)}·haiku + ${calB.toFixed(2)}`); }
} catch { console.log("no calibration data — storing raw Haiku scores"); }
const calibrate = (h) => Math.max(0, Math.min(10, Math.round((calA * h + calB) * 10) / 10));

const serper = async (p, b) => (await fetch(`https://google.serper.dev/${p}`, { method: "POST", headers: { "X-API-KEY": SERPER, "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(20000) })).json();
const PROMPT = (revs) => `You are a STRICT cosiness judge. From these guest reviews, rate how COSY the hotel actually is, 0-10.
COSY = warmth, intimacy, character, charm, warm lighting, fireplaces, natural materials, a homely intimate small-scale feel, warm personal service. NOT COSY = cold, corporate, sterile, large/impersonal, dated/run-down.
Judge from concrete things guests describe, not generic praise. Most hotels are 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy.
Reply ONLY JSON: {"cosy": <0-10 number>}
REVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
let haikuTokens = 0;
async function haiku(revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHRO, "anthropic-version": "2023-06-01", "content-type": "application/json" }, signal: AbortSignal.timeout(40000), body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 60, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const j = await r.json(); if (j.error) { if (a === 1) return null; continue; } haikuTokens += (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0); const m = (j.content?.[0]?.text || "").match(/\{[\s\S]*\}/); return Math.max(0, Math.min(10, Number(JSON.parse(m[0]).cosy) || 0)); } catch { if (a === 1) return null; } } }

async function reviewsFor(h) {
  if (cache[h.id]?.length) return cache[h.id];
  const pl = await serper("places", { q: `${h.name} ${h.city || ""}`.trim() }); serperCalls++;
  const cid = (pl.places || [])[0]?.cid; if (!cid) return [];
  const rv = await serper("reviews", { cid: String(cid) }); serperCalls++;
  const revs = [...new Set((rv.reviews || []).map((x) => (x.snippet || "").replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
  cache[h.id] = revs; writeFileSync(CACHE, JSON.stringify(cache));
  return revs;
}

// ---- target: un-grounded (no photo warmth) shown hotels, highest score first ----
const usable = new Set(); let off = 0;
for (;;) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999); if (!data?.length) break; for (const im of data) { const u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co") && !u.startsWith("/api/places")) usable.add(String(im.hotel_id)); } if (data.length < 1000) break; off += 1000; }
const sc = []; off = 0;
for (;;) { const { data } = await db.from("cosy_scores").select("hotel_id,score,score_final,imagery_warmth,review_sentiment").gte("score_final", MIN).range(off, off + 999); if (!data?.length) break; sc.push(...data); if (data.length < 1000) break; off += 1000; }
// RESUMABLE: skip hotels already review-scored (review_sentiment set) so repeat runs only do new ones — no double-spend.
const target = sc.filter((r) => !(r.imagery_warmth > 0) && !usable.has(String(r.hotel_id)) && r.review_sentiment == null).sort((a, b) => (b.score_final || 0) - (a.score_final || 0)).slice(0, LIMIT);
const ids = target.map((r) => String(r.hotel_id));
const nameOf = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,city,lat,lng").in("id", ids.slice(i, i + 300)); for (const h of data || []) nameOf.set(String(h.id), h); }
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${target.length} un-grounded shown hotels to review-score (Haiku @20, highest score first)\n`);

let serperCalls = 0, done = 0, scored = 0, noRev = 0, n = 0;
const recent = [];
const startedAt = Date.now();
const saveState = (finished = false) => writeFileSync(STATE, JSON.stringify({ total: target.length, processed: n, scored, noRev, serperCalls, haikuTokens, estCostUSD: Number((serperCalls / 1000 * 1.0 + haikuTokens / 1e6 * 1.0).toFixed(2)), startedAt, updatedAt: Date.now(), execute: EXECUTE, finished, recent: recent.slice(-16) }));
saveState();
for (const r of target) {
  n++; const h = nameOf.get(String(r.hotel_id)); if (!h) continue;
  try {
    const revs = await reviewsFor({ id: String(r.hotel_id), name: h.name, city: h.city });
    if (!revs || revs.length < 3) { noRev++; saveState(); continue; }
    const raw = await haiku(revs); if (raw == null) { saveState(); continue; }
    const cal = calibrate(raw);
    if (EXECUTE) {
      appendFileSync(BACKUP, JSON.stringify({ hotel_id: r.hotel_id, prev_score: r.score, prev_score_final: r.score_final }) + "\n");
      const { error } = await db.from("cosy_scores").update({ score: cal, score_final: cal, review_sentiment: raw, notes: "review-scored:haiku@20" }).eq("hotel_id", r.hotel_id);
      if (!error) scored++;
    } else scored++;
    done++;
    recent.push({ name: h.name, raw, cal });
    if (n % 5 === 0) { console.log(`  ${n}/${target.length} · ${h.name?.slice(0, 30)} raw ${raw} → cal ${cal} · $${(serperCalls / 1000 + haikuTokens / 1e6).toFixed(2)}`); }
    saveState();
  } catch (e) { console.log(`  skip ${(h.name || "").slice(0, 28)}: ${String(e.message).slice(0, 40)}`); saveState(); }
}
saveState(true);
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"} · scored ${scored} · no-reviews ${noRev} · serper calls ${serperCalls} · haiku tokens ${haikuTokens} · est $${(serperCalls / 1000 + haikuTokens / 1e6).toFixed(2)}`);
if (EXECUTE) console.log(`backup: ${BACKUP} (restore = set score/score_final back per line)`);

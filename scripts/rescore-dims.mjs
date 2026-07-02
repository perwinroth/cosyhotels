#!/usr/bin/env node
// DIMENSIONAL rescore: warmth / intimacy / character / service, each 0-100, from cached reviews.
// Why: single-value LLM scoring at temp 0 quantizes (16 distinct values; 34% of hotels on one) —
// averaging four sub-scores yields fine-grained, meaning-bearing totals (68,72,75,61 -> 69.0),
// stores per-dimension data (fuel for the "what makes a hotel cosy" study + hotelier asset), and
// keeps the same calibration to Per's owner grades. Guest-rating tiebreak (±0.2, directionally
// validated) folds in where a rating exists.
//   final = calibrate(mean(dims)/10) + clamp(0.08*(rating10 - median), -0.2, +0.2)
//   node --env-file=.env.local scripts/rescore-dims.mjs --limit 30   # pilot dry-run
//   node --env-file=.env.local scripts/rescore-dims.mjs --execute    # full (backs up, resumable)
// notes -> 'review-scored:v4' (skips v4 rows on re-run). Descriptions/signals are NOT touched.
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIMIT = Number(flag("--limit", 0)) || 0;
const CONC = Number(flag("--conc", 8));
const BUDGET = Number(flag("--budget", 25));
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const HAIKU = "claude-haiku-4-5";
const CACHE = "scripts/backups/review-cache.json";
const STATE = "scripts/backups/rescore-dims-progress.json";
const BACKUP = `scripts/backups/rescore-dims-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

let calA = 1, calB = 0;
try {
  const extra = JSON.parse(readFileSync("scripts/backups/bakeoff-extra.json", "utf8"));
  const bo = JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8"));
  const pairs = bo.filter((r) => extra[r.id]?.h20 != null && typeof r.grade === "number").map((r) => [extra[r.id].h20, r.grade]);
  if (pairs.length >= 15) { const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0); calA = (n * sxy - sx * sy) / (n * sxx - sx * sx); calB = (sy - calA * sx) / n; console.log(`calibration: grade ≈ ${calA.toFixed(2)}·llm + ${calB.toFixed(2)}`); }
} catch { console.log("no calibration data"); }

const PRICE = { in: 1 / 1e6, out: 5 / 1e6 };
let tin = 0, tout = 0;
const usd = () => tin * PRICE.in + tout * PRICE.out;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SCHEMA = { type: "object", additionalProperties: false, properties: { warmth: { type: "integer" }, intimacy: { type: "integer" }, character: { type: "integer" }, service: { type: "integer" }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["warmth", "intimacy", "character", "service", "confidence"] };
const prompt = (h, revs) => `You are a strict cosiness judge. Using ONLY these guest reviews, score this hotel 0-100 on each dimension, with full granularity (any integer, not just multiples of 5):
- warmth: warm lighting, fires, textiles, colour, physical warmth of the spaces
- intimacy: small human scale, snugness, quiet, privacy, "tucked-away" feel
- character: individuality, story, materials, antiques, anything a chain couldn't copy
- service: personal, host-like care guests name (owners remembered, personal tips, homemade breakfast)
Anchors per dimension: 80-100 exceptional, 65-79 clearly strong, 50-64 pleasant, 35-49 weak, <35 absent/cold. Judge only what guests concretely describe.
JSON: {"warmth":<int>,"intimacy":<int>,"character":<int>,"service":<int>,"confidence":"low|medium|high"}
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
const cleanRevs = (arr) => [...new Set((arr || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);

async function claude(content) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await anthropic.messages.create({ model: HAIKU, max_tokens: 200, temperature: 0, messages: [{ role: "user", content }], output_config: { format: { type: "json_schema", schema: SCHEMA } } });
      tin += r.usage?.input_tokens || 0; tout += r.usage?.output_tokens || 0;
      return JSON.parse(r.content.find((b) => b.type === "text")?.text || "null");
    } catch (e) { const st = e?.status; if (st === 429 || st >= 500 || st == null) { await sleep(1500 * (a + 1)); continue; } return null; }
  }
  return null;
}

// targets: live review-scored v3 rows (vision rows keep their photo-grounded score)
const rows = []; let off = 0;
const COLS = "hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at,dims";
for (;;) { const { data } = await db.from("cosy_scores").select(COLS).gte("score", 5).eq("notes", "review-scored:v3").range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
let target = rows;
if (LIMIT) target = target.slice(0, LIMIT);
const ids = target.map((r) => String(r.hotel_id));
const meta = new Map(); const rating = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city,country,rating").in("id", ids.slice(i, i + 300)); for (const h of data || []) { meta.set(String(h.id), h); if (typeof h.rating === "number") rating.set(String(h.id), Number(h.rating)); } }
const rs = [...rating.values()].sort((a, b) => a - b);
const median = rs.length ? rs[Math.floor(rs.length / 2)] : 9.2;
const tb = (id) => { const r = rating.get(String(id)); return r == null ? 0 : Math.max(-0.2, Math.min(0.2, 0.08 * (r - median))); };
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${target.length} live v3 hotels · conc ${CONC} · budget $${BUDGET}\n`);

let processed = 0, rescored = 0, skipped = 0, failed = 0, stopped = false;
const dist = new Map(); const recent = []; const startedAt = Date.now();
const save = (finished = false) => writeFileSync(STATE, JSON.stringify({ job: "rescore-dims", total: target.length, processed, rescored, skipped, failed, estCostUSD: +usd().toFixed(3), budgetUSD: BUDGET, distinct: dist.size, startedAt, updatedAt: Date.now(), execute: EXECUTE, finished, stopped, recent: recent.slice(-10).reverse() }, null, 2));
save();

async function handle(r) {
  const id = String(r.hotel_id);
  const h = meta.get(id); if (!h) { failed++; return; }
  const revs = cleanRevs(cache[id]);
  if (revs.length < 3) { skipped++; return; }
  const j = await claude(prompt({ ...h, name: h.name_en || h.name }, revs));
  if (!j || [j.warmth, j.intimacy, j.character, j.service].some((v) => typeof v !== "number")) { failed++; return; }
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const dims = { warmth: clamp(j.warmth), intimacy: clamp(j.intimacy), character: clamp(j.character), service: clamp(j.service) };
  const mean10 = (dims.warmth + dims.intimacy + dims.character + dims.service) / 40;
  const cal = Math.max(0, Math.min(10, calA * mean10 + calB));
  const final = Math.max(0, Math.min(10, Math.round((cal + tb(id)) * 10) / 10));
  dist.set(final, (dist.get(final) || 0) + 1);
  if (EXECUTE) {
    const prev = { score: r.score, score_final: r.score_final, score_100: r.score_100, notes: r.notes, dims: r.dims, confidence: r.confidence, scored_at: r.scored_at };
    appendFileSync(BACKUP, JSON.stringify({ hotel_id: id, ...prev }) + "\n");
    const { error } = await db.from("cosy_scores").update({ score: final, score_final: final, score_100: Math.round(final * 10), dims, confidence: j.confidence, notes: "review-scored:v4", scored_at: new Date().toISOString() }).eq("hotel_id", id);
    if (error) { failed++; return; }
  }
  rescored++;
  recent.push({ name: h.name_en || h.name, to: final, dims });
}

let cursor = 0;
async function worker() {
  while (cursor < target.length) {
    if (usd() >= BUDGET) { stopped = true; return; }
    const r = target[cursor++];
    await handle(r);
    processed++;
    if (processed % 5 === 0) save();
    if (processed % 200 === 0) console.log(`  ${processed}/${target.length} · rescored ${rescored} · fail ${failed} · distinct ${dist.size} · $${usd().toFixed(2)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save(true);
if (EXECUTE) { try { await db.from("job_runs").insert({ job: "rescore-dims:v4", status: stopped ? "budget-stop" : "done", finished_at: new Date().toISOString(), details: { total: target.length, rescored, skipped, failed, distinct: dist.size, estCostUSD: +usd().toFixed(2) } }); } catch {} }
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN"}${stopped ? " (BUDGET STOP)" : ""} · rescored ${rescored} · skipped ${skipped} · failed ${failed} · DISTINCT FINAL VALUES ${dist.size} · $${usd().toFixed(2)}`);
if (EXECUTE) console.log(`backup: ${BACKUP}`);

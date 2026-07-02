#!/usr/bin/env node
// GRANULAR (0-100) rescore of live review-scored hotels. Fixes score quantization: Haiku's integer
// 0-10 collapsed 6,529 hotels onto ~20 values (1,824 on one value) — a credibility tell for a
// ranking site. Same cached reviews, finer scale, calibrated to owner grades, score spreads to
// one-decimal resolution. Descriptions are KEPT except where they mention "reviews" or duplicate
// another hotel's copy — those get regenerated (same style rules, Sonnet for top tier).
//   node --env-file=.env.local scripts/rescore-granular.mjs                # dry-run
//   node --env-file=.env.local scripts/rescore-granular.mjs --limit 30    # pilot
//   node --env-file=.env.local scripts/rescore-granular.mjs --execute     # real (backs up)
//   flags: --conc 8  --budget 30  --limit N
// notes -> 'review-scored:v3' (resumable: v3 rows are skipped on re-run).
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const LIMIT = Number(flag("--limit", 0)) || 0;
const CONC = Number(flag("--conc", 8));
const BUDGET = Number(flag("--budget", 30));
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const HAIKU = "claude-haiku-4-5", SONNET = "claude-sonnet-4-6";
const TIER = 7.0;
const CACHE = "scripts/backups/review-cache.json";
const STATE = "scripts/backups/rescore-granular-progress.json";
const BACKUP = `scripts/backups/rescore-granular-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// calibration: haiku 0-10 -> owner grade (same regression as score-and-describe)
let calA = 1, calB = 0;
try {
  const extra = JSON.parse(readFileSync("scripts/backups/bakeoff-extra.json", "utf8"));
  const bo = JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8"));
  const pairs = bo.filter((r) => extra[r.id]?.h20 != null && typeof r.grade === "number").map((r) => [extra[r.id].h20, r.grade]);
  if (pairs.length >= 15) { const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0); calA = (n * sxy - sx * sy) / (n * sxx - sx * sx); calB = (sy - calA * sx) / n; console.log(`calibration: grade ≈ ${calA.toFixed(2)}·haiku + ${calB.toFixed(2)}`); }
} catch { console.log("no calibration data — raw scores"); }
const calibrate = (h10) => Math.max(0, Math.min(10, Math.round((calA * h10 + calB) * 10) / 10));

const PRICE = { [HAIKU]: { in: 1 / 1e6, out: 5 / 1e6 }, [SONNET]: { in: 3 / 1e6, out: 15 / 1e6 } };
let cost = { [HAIKU]: { in: 0, out: 0 }, [SONNET]: { in: 0, out: 0 } };
const usd = () => Object.entries(cost).reduce((s, [m, t]) => s + t.in * PRICE[m].in + t.out * PRICE[m].out, 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function claude(model, content, maxTok, schema) {
  for (let a = 0; a < 4; a++) {
    try {
      const params = { model, max_tokens: maxTok, temperature: 0, messages: [{ role: "user", content }] };
      if (schema) params.output_config = { format: { type: "json_schema", schema } };
      const r = await anthropic.messages.create(params);
      cost[model].in += r.usage?.input_tokens || 0; cost[model].out += r.usage?.output_tokens || 0;
      return r.content.find((b) => b.type === "text")?.text || "";
    } catch (e) { const st = e?.status; if (st === 429 || st >= 500 || st == null) { await sleep(1500 * (a + 1)); continue; } return null; }
  }
  return null;
}
const parseJson = (t) => { try { return JSON.parse(t); } catch { return null; } };
const SCORE_SCHEMA = { type: "object", additionalProperties: false, properties: { cosy100: { type: "integer" }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["cosy100", "confidence"] };
const FULL_SCHEMA = { type: "object", additionalProperties: false, properties: { cosy100: { type: "integer" }, confidence: { type: "string", enum: ["low", "medium", "high"] }, signals: { type: "array", items: { type: "string" } }, description: { type: "string" } }, required: ["cosy100", "confidence", "signals", "description"] };

const COSY_DEF = `COSY = warmth, intimacy, character, charm, warm lighting, fireplaces, natural materials, a homely small-scale feel, warm personal service. NOT COSY = cold, corporate, sterile, large/impersonal, dated/run-down.`;
const STYLE = `Write in warm, specific British English, exactly ONE sentence, grounded ONLY in what guests actually mention. Name concrete details. NEVER use the words "genuine" or "genuinely". NEVER mention "reviews" or "guests say" — describe the hotel directly. NEVER speculate or hedge.`;
const RUBRIC = `Score on a 0-100 COSINESS scale with full granularity — use ANY integer (e.g. 58, 63, 71, 77), NOT just multiples of 5 or 10. Anchors: 80-100 exceptionally cosy (fires, candlelight, intimate scale, beloved hosts), 65-79 clearly cosy, 50-64 pleasant with some warmth, 35-49 fine but impersonal, <35 cold/corporate/run-down. Judge concrete things guests describe.`;

const scoreOnly = (h, revs) => `You are a strict cosiness judge. Using ONLY these guest reviews, score this hotel's cosiness.
${COSY_DEF}
${RUBRIC}
JSON: {"cosy100": <int>, "confidence": "low|medium|high"}
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
const scoreAndDesc = (h, revs) => `You are a strict cosiness judge. Using ONLY these guest reviews, score this hotel's cosiness AND write one sentence.
${COSY_DEF}
${RUBRIC}
${STYLE}
JSON: {"cosy100": <int>, "confidence": "low|medium|high", "signals": [<2-4 short cues>], "description": "<one sentence>"}
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
const prosePrompt = (h, revs) => `Write ONE warm, specific sentence describing this hotel's cosy character, grounded ONLY in these guest reviews. ${STYLE} Return ONLY the sentence.
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

const cleanRevs = (arr) => [...new Set((arr || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
const cleanSentence = (s) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
const HEDGE = /(little detail|limited (data|detail|information)|name suggest|hard to (say|assess)|appears to|seems to|\bgenuine(ly)?\b|\yreviews?\y|guests? (say|report|mention))/i;
const badDesc = (s) => !s || String(s).trim().length < 40 || HEDGE.test(s);

// ---- targets: live review-scored rows ------------------------------------------------------------
console.log("loading live hotels…");
const rows = []; let off = 0;
const COLS = "hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at";
for (;;) { const { data } = await db.from("cosy_scores").select(COLS).gte("score", 5).like("notes", "review-scored:%").range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
// duplicate-description rows need fresh copy
const descCount = new Map();
for (const r of rows) if (r.description) descCount.set(r.description, (descCount.get(r.description) || 0) + 1);
let target = rows.filter((r) => r.notes !== "review-scored:v3");
if (LIMIT) target = target.slice(0, LIMIT);
const ids = target.map((r) => String(r.hotel_id));
const meta = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city,country").in("id", ids.slice(i, i + 300)); for (const h of data || []) meta.set(String(h.id), h); }
const needsNewDesc = (r) => !r.description || /\yreviews?\y|guests? (say|report|mention)/i.test(r.description) || (descCount.get(r.description) || 0) > 1;
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${target.length} live review-scored hotels · ${target.filter(needsNewDesc).length} also get fresh copy · conc ${CONC} · budget $${BUDGET}\n`);

let processed = 0, rescored = 0, redescribed = 0, skippedNoRevs = 0, failed = 0, stopped = false;
const recent = []; const startedAt = Date.now();
const dist = new Map();
const save = (finished = false) => writeFileSync(STATE, JSON.stringify({ job: "rescore-granular", total: target.length, processed, rescored, redescribed, skippedNoRevs, failed, estCostUSD: +usd().toFixed(3), budgetUSD: BUDGET, startedAt, updatedAt: Date.now(), execute: EXECUTE, finished, stopped, recent: recent.slice(-12).reverse() }, null, 2));
save();

async function writeRow(hotel_id, prev, patch) {
  if (!EXECUTE) return true;
  appendFileSync(BACKUP, JSON.stringify({ hotel_id, ...prev }) + "\n");
  const { error } = await db.from("cosy_scores").update(patch).eq("hotel_id", hotel_id);
  if (error) { console.log(`  db err ${hotel_id}: ${error.message.slice(0, 60)}`); return false; }
  return true;
}

async function handle(r) {
  const id = String(r.hotel_id);
  const h = meta.get(id); if (!h) { failed++; return; }
  const name = h.name_en || h.name;
  const revs = cleanRevs(cache[id]);
  if (revs.length < 3) { skippedNoRevs++; return; } // cache purged (poison) or thin — leave for the describe pipeline
  const prev = { score: r.score, score_final: r.score_final, score_100: r.score_100, review_sentiment: r.review_sentiment, description: r.description, signals: r.signals, confidence: r.confidence, score_model: r.score_model, notes: r.notes, scored_at: r.scored_at };
  const wantDesc = needsNewDesc(r);
  try {
    const j = parseJson(await claude(HAIKU, wantDesc ? scoreAndDesc({ ...h, name }, revs) : scoreOnly({ ...h, name }, revs), wantDesc ? 900 : 200, wantDesc ? FULL_SCHEMA : SCORE_SCHEMA));
    if (!j || typeof j.cosy100 !== "number") { failed++; return; }
    const raw10 = Math.max(0, Math.min(10, j.cosy100 / 10));
    const cal = calibrate(raw10);
    const patch = { score: cal, score_final: cal, score_100: Math.round(cal * 10), review_sentiment: raw10, confidence: j.confidence || r.confidence, notes: "review-scored:v3", scored_at: new Date().toISOString(), score_model: HAIKU };
    if (wantDesc) {
      let desc = cleanSentence(j.description);
      if (cal >= TIER || badDesc(desc)) {
        const s = cleanSentence(await claude(SONNET, prosePrompt({ ...h, name }, revs), 200));
        if (!badDesc(s)) { desc = s; patch.score_model = SONNET; }
      }
      if (!badDesc(desc)) { patch.description = desc; patch.signals = (Array.isArray(j.signals) ? j.signals : []).map(cleanSentence).filter(Boolean).slice(0, 4); redescribed++; }
      // if still bad, keep the old copy (score update is independent)
    }
    const ok = await writeRow(id, prev, patch);
    if (ok) { rescored++; dist.set(cal, (dist.get(cal) || 0) + 1); recent.push({ name, from: r.score_final ?? r.score, to: cal, redesc: wantDesc }); }
  } catch (e) { failed++; }
}

let cursor = 0;
async function worker() {
  while (cursor < target.length) {
    if (usd() >= BUDGET) { stopped = true; return; }
    const r = target[cursor++];
    await handle(r);
    processed++;
    if (processed % 5 === 0) save();
    if (processed % 100 === 0) console.log(`  ${processed}/${target.length} · rescored ${rescored} · redescribed ${redescribed} · fail ${failed} · $${usd().toFixed(2)} · distinct scores so far: ${dist.size}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save(true);
if (EXECUTE) { try { await db.from("job_runs").insert({ job: "rescore-granular:v3", status: stopped ? "budget-stop" : "done", finished_at: new Date().toISOString(), details: { total: target.length, processed, rescored, redescribed, skippedNoRevs, failed, estCostUSD: +usd().toFixed(2), distinctScores: dist.size } }); } catch {} }
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"}${stopped ? " (BUDGET STOP)" : ""} · rescored ${rescored} · redescribed ${redescribed} · skipped(no revs) ${skippedNoRevs} · failed ${failed} · distinct score values ${dist.size} · $${usd().toFixed(2)}`);
if (EXECUTE) console.log(`backup: ${BACKUP}`);

#!/usr/bin/env node
// UNIFIED review-grounded SCORE + DESCRIPTION for every live hotel (cosy_scores.score >= MIN).
// Fixes the credibility bug where a confident score sat on top of a "no data" description:
// here the score AND the one-sentence description are produced together, grounded ONLY in real
// findings (guest reviews from review-cache.json, or a vetted photo via vision).
//
//   node --env-file=.env.local scripts/score-and-describe.mjs                 # DRY-RUN (no writes)
//   node --env-file=.env.local scripts/score-and-describe.mjs --limit 30      # dry-run pilot
//   node --env-file=.env.local scripts/score-and-describe.mjs --execute       # real run (backs up first)
//   flags: --min 5  --limit N  --conc 6  --force (reprocess done rows)  --budget 80 (USD hard cap)
//
// Per-hotel branches:
//   >=3 reviews          -> Haiku {cosy,signals,confidence,description}; calibrate cosy;
//                           if calibrated >= 7.5 (higher tier) rewrite description with Sonnet.
//                           notes='review-scored:v2'
//   <3 reviews + photo   -> vision (Haiku+image) regenerates description/signals; keep score.
//                           notes='vision-described:v2'
//   <3 reviews + no photo-> HIDE: score/score_final -> NULL. notes='hidden:no-findings'
// Resumable: skips rows whose notes are already v2/hidden unless --force. Backs up prev rows.
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, readFileSync, existsSync, appendFileSync } from "fs";

const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const FORCE = args.includes("--force");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min", 5));
const NOKEEP = args.includes("--nokeep"); // never keep ungroundable metadata copy — ground it or hide it
const LIMIT = Number(flag("--limit", 0)) || 0;
const CONC = Number(flag("--conc", 6));
const BUDGET = Number(flag("--budget", 80));
const ANTHRO = process.env.ANTHROPIC_API_KEY;
if (!ANTHRO) { console.error("✗ need ANTHROPIC_API_KEY"); process.exit(1); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";
const TIER = Number(flag("--tier", 7.0)); // calibrated score at/above which we upgrade the prose to Sonnet
const CACHE = "scripts/backups/review-cache.json";
const STATE = "scripts/backups/score-describe-progress.json";
const BACKUP = `scripts/backups/score-describe-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`; // BUG5: fresh per-run backup
const SERPER = process.env.SERPER_KEY; // BUG2: re-fetch reviews on cache miss instead of hiding blindly
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// ---- calibration: map Haiku 0-10 onto owner-grade scale (same regression as score-reviews-prod) ----
let calA = 1, calB = 0;
try {
  const extra = JSON.parse(readFileSync("scripts/backups/bakeoff-extra.json", "utf8"));
  const bo = JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8"));
  const pairs = bo.filter((r) => extra[r.id]?.h20 != null && typeof r.grade === "number").map((r) => [extra[r.id].h20, r.grade]);
  if (pairs.length >= 15) { const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0); calA = (n * sxy - sx * sy) / (n * sxx - sx * sx); calB = (sy - calA * sx) / n; console.log(`calibration from ${n} graded: grade ≈ ${calA.toFixed(2)}·haiku + ${calB.toFixed(2)}`); }
} catch { console.log("no calibration data — storing raw Haiku scores"); }
const calibrate = (h) => Math.max(0, Math.min(10, Math.round((calA * h + calB) * 10) / 10));

// ---- token cost accounting ----
const PRICE = { [HAIKU]: { in: 1 / 1e6, out: 5 / 1e6 }, [SONNET]: { in: 3 / 1e6, out: 15 / 1e6 } };
let cost = { [HAIKU]: { in: 0, out: 0 }, [SONNET]: { in: 0, out: 0 } };
const usd = () => Object.entries(cost).reduce((s, [m, t]) => s + t.in * PRICE[m].in + t.out * PRICE[m].out, 0);

const anthropic = new Anthropic({ apiKey: ANTHRO });
// SDK call. When `schema` is passed we use structured JSON output (same approach as claudeCosy.ts) so
// the model CANNOT emit invalid JSON — this fixes the ~50% parse failures from unescaped quotes inside
// signal strings (e.g. Italian/German quoted words in reviews). No schema = plain text (prose calls).
async function claude(model, content, maxTok, schema) {
  for (let a = 0; a < 4; a++) {
    try {
      const params = { model, max_tokens: maxTok, temperature: 0, messages: [{ role: "user", content }] };
      if (schema) params.output_config = { format: { type: "json_schema", schema } };
      const resp = await anthropic.messages.create(params);
      cost[model].in += resp.usage?.input_tokens || 0; cost[model].out += resp.usage?.output_tokens || 0;
      const tb = resp.content.find((b) => b.type === "text");
      return tb ? tb.text : "";
    } catch (e) {
      const st = e?.status;
      if (st === 429 || (st >= 500 && st < 600) || st == null) { await sleep(1500 * (a + 1)); continue; }
      return null; // 4xx (bad request) won't fix on retry
    }
  }
  return null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parseJson = (t) => { try { return JSON.parse(t); } catch { try { const m = (t || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch { return null; } } };
// Structured-output schemas (guarantee valid JSON).
const SCORE_SCHEMA = { type: "object", additionalProperties: false, properties: { signals: { type: "array", items: { type: "string" } }, description: { type: "string" }, cosy: { type: "number" }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["signals", "description", "cosy", "confidence"] };
const VISION_SCHEMA = { type: "object", additionalProperties: false, properties: { signals: { type: "array", items: { type: "string" } }, description: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["signals", "description", "confidence"] };

const COSY_DEF = `COSY = warmth, intimacy, character, charm, warm lighting, fireplaces, natural materials, a homely small-scale feel, warm personal service. NOT COSY = cold, corporate, sterile, large/impersonal, dated/run-down.`;
const STYLE = `Write in warm, specific British English, exactly ONE sentence, grounded ONLY in what guests actually mention. Name concrete details (lighting, fireplace, rooms, breakfast, service, setting). The words "genuine" and "genuinely" are BANNED — never use them; choose more specific, varied wording. NEVER speculate. NEVER say data/details are limited/scarce, that little is known, or that "the name suggests". If reviews are lukewarm, be honest and understated, not gushing.`;

function scorePrompt(h, revs) {
  return `You are a STRICT cosiness judge. Using ONLY these guest reviews, rate how COSY the hotel actually is (0-10) and write one honest sentence.
${COSY_DEF}
Most hotels are 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy. Judge concrete things guests describe, not generic praise.
${STYLE}
Reply ONLY JSON: {"cosy": <0-10 number>, "signals": [<2-4 short cosy cues found in the reviews>], "confidence": "low|medium|high", "description": "<one grounded sentence>"}
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
}
function prosePrompt(h, revs) {
  return `Write ONE warm, specific sentence describing this hotel's cosy character for a discerning traveller, grounded ONLY in these guest reviews. ${STYLE} Return ONLY the sentence, no quotes, no preamble.
HOTEL: ${[h.name, h.city, h.country].filter(Boolean).join(", ")}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
}
function visionText(h) {
  return `Look at this photo of ${[h.name, h.city].filter(Boolean).join(", ")}. Write one honest sentence about its cosy character grounded ONLY in what is visible, plus 2-4 visible cosy signals and a confidence. ${STYLE}
Reply ONLY JSON: {"signals": [<2-4>], "confidence": "low|medium|high", "description": "<one grounded sentence>"}`;
}
const cleanRevs = (arr) => [...new Set((arr || []).map((r) => String(r).replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 20);
// BUG2 fix: the local cache is NOT an authoritative "has reviews" oracle. On a cache miss, try a live
// Serper fetch BEFORE ever considering hiding, so we never null a hotel that actually has reviews.
let serperCalls = 0;
const serper = async (p, b) => { try { return await (await fetch(`https://google.serper.dev/${p}`, { method: "POST", headers: { "X-API-KEY": SERPER, "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(20000) })).json(); } catch { return null; } };
// Name-overlap guard: never accept a Serper place whose title doesn't plausibly name this hotel.
// Blind places[0] trust is how other properties' reviews (even a pharmacy's) got cached, scored
// and published — the wrong-reviews bug (38 self-flagged + 375 silent live rows on 2026-07-02).
const normName = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const NAME_STOP = new Set(["the", "hotel", "hostal", "bed", "and", "breakfast", "guest", "house", "guesthouse", "inn", "pension", "b&b"]);
const nameToks = (s) => new Set(normName(s).split(" ").filter((t) => t.length > 2 && !NAME_STOP.has(t)));
function nameOverlap(a, b) {
  const A = nameToks(a), B = nameToks(b);
  if (!A.size || !B.size) return 0;
  let n = 0; for (const t of A) if (B.has(t)) n++;
  return n / Math.min(A.size, B.size);
}
async function reviewsFor(id, h) {
  const cached = cleanRevs(cache[id]);
  if (cached.length >= 3) return cached;
  if (!SERPER) return cached;
  const pl = await serper("places", { q: `${h.name} ${h.city || ""}`.trim() }); serperCalls++;
  const place = pl?.places?.[0];
  // reject on missing cid OR a place title that doesn't match the hotel name
  if (!place?.cid || nameOverlap(h.name, place.title || "") < 0.5) return cached;
  const rv = await serper("reviews", { cid: String(place.cid) }); serperCalls++;
  const fresh = cleanRevs((rv?.reviews || []).map((x) => x.snippet || ""));
  if (fresh.length) { cache[id] = fresh; try { writeFileSync(CACHE, JSON.stringify(cache)); } catch {} }
  return fresh.length >= 3 ? fresh : cached;
}
const cleanSentence = (s) => String(s || "").trim().replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ");
const HEDGE = /(little detail|details? (are|is)? ?(limited|scarce|sparse)|limited (data|detail|information)|not much (is )?known|name suggest|based on (its |the )?name|hard to (say|assess)|can'?t say much|few details|promise of|carries the promise|promising the kind|hints? at|name (that )?(hints|suggests)|appears to|seems to offer|likely offers)/i;
const bad = (s) => !s || String(s).trim().length < 40 || HEDGE.test(s); // HARD reject: empty/too-short/credibility hedge -> never ship
const tic = (s) => /\bgenuine(ly)?\b/i.test(s); // SOFT: stylistic tic; prefer to avoid but acceptable (not "generic")

// ---- load targets: all live hotels + metadata + vetted-photo map -------------------------------
console.log("loading live hotels…");
const rows = []; let off = 0;
// BUG1: load EVERY column we may overwrite so the backup snapshot is complete + reversible.
const COLS = "hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at";
for (;;) { const { data } = await db.from("cosy_scores").select(COLS).gte("score", MIN).range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
const photo = new Map(); off = 0;
for (;;) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999); if (!data?.length) break; for (const im of data) { const u = im.url || ""; if (im.vision_ok === true && u && /^https:\/\/\S+\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) && !photo.has(String(im.hotel_id))) photo.set(String(im.hotel_id), u); } if (data.length < 1000) break; off += 1000; }
const done = new Set(["review-scored:v2", "vision-described:v2", "hidden:no-findings"]);
let target = rows.filter((r) => FORCE || !done.has(r.notes || ""));
if (LIMIT) target = target.sort((a, b) => (b.score_final || 0) - (a.score_final || 0)).slice(0, LIMIT);
const ids = target.map((r) => String(r.hotel_id));
const meta = new Map();
for (let i = 0; i < ids.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city,country,stars").in("id", ids.slice(i, i + 300)); for (const h of data || []) meta.set(String(h.id), h); }
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${target.length} live hotels · ${photo.size} with vetted photo · conc ${CONC} · budget $${BUDGET}\n`);

// ---- run ---------------------------------------------------------------------------------------
let processed = 0, reviewScored = 0, visionDescribed = 0, hidden = 0, kept = 0, failed = 0, sonnetUpgrades = 0, stopped = false;
const recent = [];
const startedAt = Date.now();
const save = (finished = false) => writeFileSync(STATE, JSON.stringify({
  job: "score-and-describe", total: target.length, processed, reviewScored, visionDescribed, hidden, kept, failed, sonnetUpgrades,
  haikuTokens: cost[HAIKU].in + cost[HAIKU].out, sonnetTokens: cost[SONNET].in + cost[SONNET].out, serperCalls,
  estCostUSD: +(usd() + serperCalls / 1000).toFixed(3), budgetUSD: BUDGET, startedAt, updatedAt: Date.now(), execute: EXECUTE, finished, stopped,
  recent: recent.slice(-14).reverse(),
}, null, 2));
save();

async function writeRow(hotel_id, prev, patch) {
  if (!EXECUTE) return true;
  appendFileSync(BACKUP, JSON.stringify({ hotel_id, ...prev }) + "\n");
  const { error } = await db.from("cosy_scores").update(patch).eq("hotel_id", hotel_id);
  if (error) { console.log(`  db err ${hotel_id}: ${error.message.slice(0, 60)}`); return false; }
  return true;
}

const wasReviewScored = (notes) => /^review-scored/.test(notes || ""); // haiku@20 or v2 -> HAD real reviews
async function hideOrKeep(id, prev, r, name) {
  // Keep a prior review-scored hotel ONLY if its existing copy is already specific (not generic/hedge/empty).
  // With --nokeep we never keep metadata-based copy — a live hotel MUST be grounded in reviews/pictures.
  if (!NOKEEP && wasReviewScored(r.notes) && r.description && r.description.trim().length > 40 && !bad(r.description)) {
    kept++; recent.push({ name, score: r.score_final ?? r.score, tier: "K", desc: "kept (good prior copy): " + r.description.slice(0, 80) }); return;
  }
  // Hide: `score` is NOT NULL, so use a sub-floor sentinel 0 (excluded by every .gte("score",5) gate);
  // null the nullable /10 and secret /100 so nothing can resurrect it. Fully reversible via backup.
  const ok = await writeRow(id, prev, { score: 0, score_final: null, score_100: null, notes: "hidden:no-findings" });
  if (ok) { hidden++; recent.push({ name, score: null, tier: "-", desc: "hidden (no findings)" }); }
}

async function handle(r) {
  const id = String(r.hotel_id);
  const h = meta.get(id); if (!h) { failed++; return; }
  const name = h.name_en || h.name;
  // BUG1: complete snapshot of every column we may overwrite (+ score_100) for true reversibility.
  const prev = { score: r.score, score_final: r.score_final, score_100: r.score_100, review_sentiment: r.review_sentiment, description: r.description, signals: r.signals, confidence: r.confidence, score_model: r.score_model, notes: r.notes, scored_at: r.scored_at };
  const revs = await reviewsFor(id, { ...h, name }); // cache, else live Serper fetch
  try {
    if (revs.length >= 3) {
      const j = parseJson(await claude(HAIKU, scorePrompt({ ...h, name }, revs), 900, SCORE_SCHEMA));
      if (!j || typeof j.cosy !== "number") { failed++; return; }
      const raw = Math.max(0, Math.min(10, Number(j.cosy) || 0));
      const cal = calibrate(raw);
      let desc = cleanSentence(j.description);
      const conf = ["low", "medium", "high"].includes(j.confidence) ? j.confidence : "medium";
      const signals = (Array.isArray(j.signals) ? j.signals : []).map(cleanSentence).filter(Boolean).slice(0, 4);
      if (cal >= TIER) { // higher tier -> Sonnet prose (prefer clean, tic-free)
        const s = cleanSentence(await claude(SONNET, prosePrompt({ ...h, name }, revs), 200));
        if (!bad(s) && !tic(s)) { desc = s; sonnetUpgrades++; }
      }
      if (bad(desc) || tic(desc)) { // regenerate once with Sonnet to clear a hedge or the tic
        const s = cleanSentence(await claude(SONNET, prosePrompt({ ...h, name }, revs), 200));
        if (s && !bad(s) && (!tic(s) || bad(desc))) desc = s; // take it if it fixes a HARD problem, or clears the tic
      }
      if (bad(desc)) { await hideOrKeep(id, prev, r, name); return; } // only a hedge/empty left -> can't ship copy -> hide
      // BUG4: keep the two-score model coupled — score_100 tracks the review-grounded /10.
      const ok = await writeRow(id, prev, { score: cal, score_final: cal, score_100: Math.round(cal * 10), review_sentiment: raw, description: desc, signals, confidence: conf, score_model: cal >= TIER ? SONNET : HAIKU, notes: "review-scored:v2", scored_at: new Date().toISOString() });
      if (ok) { reviewScored++; recent.push({ name, score: cal, tier: cal >= TIER ? "S" : "H", desc: desc.slice(0, 120) }); }
    } else if (photo.has(id)) {
      const content = [{ type: "text", text: visionText({ ...h, name }) }, { type: "image", source: { type: "url", url: photo.get(id) } }];
      const j = parseJson(await claude(HAIKU, content, 700, VISION_SCHEMA));
      const desc = cleanSentence(j?.description);
      if (bad(desc)) { await hideOrKeep(id, prev, r, name); return; } // no grounded text from photo
      const conf = ["low", "medium", "high"].includes(j.confidence) ? j.confidence : "low";
      const signals = (Array.isArray(j.signals) ? j.signals : []).map(cleanSentence).filter(Boolean).slice(0, 4);
      const ok = await writeRow(id, prev, { description: desc, signals, confidence: conf, notes: "vision-described:v2" });
      if (ok) { visionDescribed++; recent.push({ name, score: r.score_final ?? r.score, tier: "V", desc: desc.slice(0, 120) }); }
    } else { // no findings at all
      await hideOrKeep(id, prev, r, name);
    }
  } catch (e) { failed++; console.log(`  skip ${name?.slice(0, 28)}: ${String(e.message).slice(0, 50)}`); }
}

// concurrency pool with budget guard + periodic progress save
let cursor = 0;
async function worker() {
  while (cursor < target.length) {
    if (usd() >= BUDGET) { stopped = true; return; }
    const r = target[cursor++];
    await handle(r);
    processed++;
    if (processed % 3 === 0) save();
    if (processed % 25 === 0) console.log(`  ${processed}/${target.length} · rev ${reviewScored} vis ${visionDescribed} hid ${hidden} fail ${failed} · sonnet ${sonnetUpgrades} · $${usd().toFixed(2)}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
save(true);
// Durable run-level audit record so a future session/query knows this v2 pass happened + its results.
if (EXECUTE) { try { await db.from("job_runs").insert({ job: "score-and-describe:v2", status: stopped ? "budget-stop" : "done", finished_at: new Date().toISOString(), details: { total: target.length, processed, reviewScored, visionDescribed, hidden, kept, failed, sonnetUpgrades, estCostUSD: +(usd() + serperCalls / 1000).toFixed(2) } }); console.log("job_runs audit record written"); } catch (e) { console.log("job_runs write failed:", String(e.message).slice(0, 60)); } }
console.log(`\n${EXECUTE ? "DONE" : "DRY-RUN COMPLETE"}${stopped ? " (BUDGET STOP)" : ""} · reviewScored ${reviewScored} · visionDescribed ${visionDescribed} · hidden ${hidden} · kept ${kept} · failed ${failed} · sonnet upgrades ${sonnetUpgrades} · serper ${serperCalls} · est $${(usd() + serperCalls / 1000).toFixed(2)}`);
if (EXECUTE) console.log(`backup: ${BACKUP} (per-row full prev snapshot; restore = first line per hotel_id)`);

#!/usr/bin/env node
// DEFINITIVE review-signal test. Validates review-based cosiness against TWO truths:
//   (a) owner grades (hotel_grades.human_score) — the clean gold standard
//   (b) a photo-warmth sample (imagery_warmth) — bigger but noisier (single photo)
// Deeper reviews (2 pages ~40), sharper prompt, local Qwen scoring ($0), resilient + incremental.
//   node --env-file=.env.local scripts/review-validate.mjs --photo 150
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";

const args = process.argv.slice(2);
const PHOTO_N = Number(args.includes("--photo") ? args[args.indexOf("--photo") + 1] : 150);
const MODEL = args.includes("--model") ? args[args.indexOf("--model") + 1] : "qwen2.5vl:7b";
const THINK = args.includes("--think");            // chain-of-thought on (slower, maybe better)
const GRADED_ONLY = args.includes("--graded-only"); // only score owner-graded hotels (for the A/B)
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : "scripts/backups/review-validate.json";
const KEY = process.env.SERPER_KEY;
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
// Cache fetched review text so testing a different --model never re-spends Serper credits.
const CACHE = "scripts/backups/review-cache.json";
const reviewCache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
console.log(`scorer model: ${MODEL} · think=${THINK} · gradedOnly=${GRADED_ONLY} · cached: ${Object.keys(reviewCache).length}`);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!KEY) { console.error("✗ set SERPER_KEY"); process.exit(1); }
const serper = async (path, body) => { const r = await fetch(`https://google.serper.dev/${path}`, { method: "POST", headers: { "X-API-KEY": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); return r.json(); };
const corr = (x, y) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };

// (a) owner-graded hotels = gold truth
const { data: grades } = await db.from("hotel_grades").select("hotel_id,human_score");
const gradeOf = new Map((grades || []).filter((g) => typeof g.human_score === "number").map((g) => [String(g.hotel_id), Number(g.human_score)]));
// (b) photo-grounded sample, spread across the range
const groundAll = [];
for (let off = 0; ; off += 1000) { const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999); if (!data?.length) break; groundAll.push(...data); if (data.length < 1000) break; }
const stepN = Math.max(1, Math.floor(groundAll.length / PHOTO_N));
const photoSample = groundAll.filter((_, i) => i % stepN === 0).slice(0, PHOTO_N);
const warmOf = new Map(photoSample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));

const allIds = GRADED_ONLY ? [...gradeOf.keys()] : [...new Set([...gradeOf.keys(), ...photoSample.map((r) => String(r.hotel_id))])];
const idMeta = new Map();
for (let i = 0; i < allIds.length; i += 300) { const { data } = await db.from("hotels").select("id,name,city,country").in("id", allIds.slice(i, i + 300)); for (const h of data || []) idMeta.set(String(h.id), h); }
console.log(`graded(gold)=${gradeOf.size} · photo-sample=${warmOf.size} · unique hotels to fetch=${allIds.length}`);

async function reviewsFor(h) {
  const pl = await serper("places", { q: `${h.name} ${h.city || ""}`.trim() });
  const place = (pl.places || [])[0];
  if (!place?.cid) return [];
  let all = [], token;
  for (let page = 0; page < 2; page++) {
    const rv = await serper("reviews", token ? { cid: String(place.cid), nextPageToken: token } : { cid: String(place.cid) });
    all.push(...(rv.reviews || []));
    token = rv.nextPageToken; if (!token) break;
  }
  return [...new Set(all.map((x) => (x.snippet || "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 15))].slice(0, 25);
}
const PROMPT = (revs) => `You are a STRICT cosiness judge. From these guest reviews, rate how COSY the hotel actually is, 0-10.
COSY = warmth, intimacy, character, charm, soft warm lighting, fireplaces, natural wood/stone/textiles, a homely intimate small-scale feel, warm personal service.
NOT COSY = cold, corporate, sterile, large/impersonal, business-like, dated or run-down without charm.
Rules: judge from CONCRETE things guests describe, not generic praise ("nice", "good location", "clean" are neutral, not cosy). Weigh the overall picture. If guests describe problems (dirty, cold, noisy, impersonal, tired), score low. Be discerning — most hotels are a 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy.
Reply ONLY JSON: {"cosy": <0-10 number>, "why":"<max 8 words>"}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(120000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, think: THINK, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const p = JSON.parse((await r.json()).message.content); return Math.max(0, Math.min(10, Number(p.cosy) || 0)); } catch { if (a === 1) return null; } } }

const out = []; let n = 0, noRev = 0;
for (const id of allIds) {
  n++; const h = idMeta.get(id); if (!h) continue;
  try {
    let revs = reviewCache[id];
    if (!revs) { revs = await reviewsFor(h); reviewCache[id] = revs; writeFileSync(CACHE, JSON.stringify(reviewCache)); }
    if (revs.length < 3) { noRev++; continue; }
    const cosy = await qwenScore(revs); if (cosy == null) continue;
    out.push({ id, name: h.name, reviewScore: cosy, grade: gradeOf.get(id) ?? null, warmth: warmOf.get(id) ?? null, nReviews: revs.length });
    if (n % 10 === 0) console.log(`  ${n}/${allIds.length} processed · ${out.length} scored`);
    writeFileSync(OUT, JSON.stringify(out, null, 1));
  } catch (e) { console.log(`  skip ${(h.name || "").slice(0, 28)}: ${String(e.message).slice(0, 40)}`); }
}

const vsGrade = out.filter((o) => o.grade != null);
const vsPhoto = out.filter((o) => o.warmth != null);
console.log(`\n=== RESULTS (n scored ${out.length}, no-reviews ${noRev}) ===`);
if (vsGrade.length >= 10) console.log(`vs OWNER GRADES (gold):  correlation ${corr(vsGrade.map((o) => o.reviewScore), vsGrade.map((o) => o.grade)).toFixed(3)}   MAE ${(vsGrade.reduce((s, o) => s + Math.abs(o.reviewScore - o.grade), 0) / vsGrade.length).toFixed(2)}   n=${vsGrade.length}`);
if (vsPhoto.length >= 10) console.log(`vs PHOTO warmth (noisy): correlation ${corr(vsPhoto.map((o) => o.reviewScore), vsPhoto.map((o) => o.warmth)).toFixed(3)}   MAE ${(vsPhoto.reduce((s, o) => s + Math.abs(o.reviewScore - o.warmth), 0) / vsPhoto.length).toFixed(2)}   n=${vsPhoto.length}`);
console.log("(today's text model vs photo = 0.11)");

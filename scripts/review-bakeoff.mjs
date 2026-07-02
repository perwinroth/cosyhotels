#!/usr/bin/env node
// 5-WAY SCORER BAKE-OFF on the SAME owner-graded hotels (gold truth). For each graded hotel we
// fetch its guest reviews once (cached), then score cosiness from those reviews with every model,
// and rank them by correlation to your grades. Tells us which scorer to use for production.
//   node --env-file=.env.local scripts/review-bakeoff.mjs
// Models: qwen3:14b (local), qwen3:14b+thinking (local), claude haiku/sonnet/opus (API, ~$2 total).
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "fs";

const KEY = process.env.SERPER_KEY, ANTHRO = process.env.ANTHROPIC_API_KEY;
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const CACHE = "scripts/backups/review-cache.json";
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
const serper = async (p, b) => (await fetch(`https://google.serper.dev/${p}`, { method: "POST", headers: { "X-API-KEY": KEY, "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(20000) })).json();
const corr = (x, y) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };

const PROMPT = (revs) => `You are a STRICT cosiness judge. From these guest reviews, rate how COSY the hotel actually is, 0-10.
COSY = warmth, intimacy, character, charm, soft warm lighting, fireplaces, natural wood/stone/textiles, a homely intimate small-scale feel, warm personal service.
NOT COSY = cold, corporate, sterile, large/impersonal, business-like, dated or run-down without charm.
Rules: judge from CONCRETE things guests describe, not generic praise. Weigh the overall picture. If guests describe problems (dirty, cold, noisy, impersonal, tired), score low. Be discerning — most hotels are 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy.
Reply ONLY JSON: {"cosy": <0-10 number>, "why":"<max 8 words>"}
REVIEWS:
${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
const parseCosy = (txt) => { try { const m = txt.match(/\{[\s\S]*\}/); return Math.max(0, Math.min(10, Number(JSON.parse(m[0]).cosy) || 0)); } catch { return null; } };
async function ollama(model, think, revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(150000), body: JSON.stringify({ model, format: "json", stream: false, think, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) }); return parseCosy((await r.json()).message.content); } catch { if (a === 1) return null; } } }
async function claude(model, revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHRO, "anthropic-version": "2023-06-01", "content-type": "application/json" }, signal: AbortSignal.timeout(40000), body: JSON.stringify({ model, max_tokens: 200, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const j = await r.json(); if (j.error) { if (a === 1) { console.log("  claude err:", j.error.message?.slice(0, 60)); return null; } continue; } return parseCosy(j.content?.[0]?.text || ""); } catch { if (a === 1) return null; } } }

// gold-truth graded hotels
const { data: grades } = await db.from("hotel_grades").select("hotel_id,human_score");
const graded = (grades || []).filter((g) => typeof g.human_score === "number");
const ids = graded.map((g) => String(g.hotel_id));
const gradeOf = new Map(graded.map((g) => [String(g.hotel_id), Number(g.human_score)]));
const meta = new Map();
for (let i = 0; i < ids.length; i += 200) { const { data } = await db.from("hotels").select("id,name,city").in("id", ids.slice(i, i + 200)); for (const h of data || []) meta.set(String(h.id), h); }

const CONFIGS = [
  { key: "qwen14b", label: "qwen3:14b", fn: (revs) => ollama("qwen3:14b", false, revs) },
  { key: "haiku", label: "claude-haiku-4-5", fn: (revs) => claude("claude-haiku-4-5", revs) },
  { key: "sonnet", label: "claude-sonnet-4-6", fn: (revs) => claude("claude-sonnet-4-6", revs) },
  { key: "opus", label: "claude-opus-4-8", fn: (revs) => claude("claude-opus-4-8", revs) },
  { key: "qwen14b_think", label: "qwen3:14b+thinking", fn: (revs) => ollama("qwen3:14b", true, revs) }, // slowest, last
];
const rows = []; // {id, grade, reviews, scores:{}}
console.log(`bake-off over ${ids.length} graded hotels · models: ${CONFIGS.map((c) => c.label).join(", ")}\n`);

// fetch reviews for all (cache), then score per config
let n = 0;
for (const id of ids) {
  n++; const h = meta.get(id); if (!h) continue;
  let revs = cache[id];
  if (!revs) { try { const pl = await serper("places", { q: `${h.name} ${h.city || ""}`.trim() }); const cid = (pl.places || [])[0]?.cid; if (cid) { let all = [], t; for (let p = 0; p < 2; p++) { const rv = await serper("reviews", t ? { cid: String(cid), nextPageToken: t } : { cid: String(cid) }); all.push(...(rv.reviews || [])); t = rv.nextPageToken; if (!t) break; } revs = [...new Set(all.map((x) => (x.snippet || "").replace(/\s+/g, " ").trim()).filter((s) => s.length > 15))].slice(0, 25); cache[id] = revs; writeFileSync(CACHE, JSON.stringify(cache)); } } catch {} }
  if (!revs || revs.length < 3) continue;
  rows.push({ id, name: h.name, grade: gradeOf.get(id), reviews: revs, scores: {} });
}
console.log(`${rows.length} hotels have reviews. scoring...\n`);

function report(done) {
  console.log(`\n=== BAKE-OFF (vs owner grades, n varies) ${done ? "— FINAL" : "— partial"} ===`);
  const ranked = CONFIGS.map((c) => { const r = rows.filter((x) => typeof x.scores[c.key] === "number"); if (r.length < 8) return { label: c.label, corr: null, n: r.length }; const cc = corr(r.map((x) => x.scores[c.key]), r.map((x) => x.grade)); const mae = r.reduce((s, x) => s + Math.abs(x.scores[c.key] - x.grade), 0) / r.length; return { label: c.label, corr: cc, mae, n: r.length }; }).sort((a, b) => (b.corr ?? -9) - (a.corr ?? -9));
  for (const x of ranked) console.log(`  ${x.label.padEnd(22)} corr ${x.corr == null ? "—" : x.corr.toFixed(3)}   MAE ${x.mae ? x.mae.toFixed(2) : "—"}   n=${x.n}`);
  console.log("  (qwen2.5-VL-7b vision baseline ≈ 0.40 · old text model 0.11)");
}

for (const c of CONFIGS) {
  let i = 0;
  for (const row of rows) { i++; row.scores[c.key] = await c.fn(row.reviews); if (i % 20 === 0) { console.log(`  ${c.label}: ${i}/${rows.length}`); writeFileSync("scripts/backups/bakeoff.json", JSON.stringify(rows.map(({ reviews, ...r }) => r), null, 1)); } }
  report(false);
}
writeFileSync("scripts/backups/bakeoff.json", JSON.stringify(rows.map(({ reviews, ...r }) => r), null, 1));
report(true);

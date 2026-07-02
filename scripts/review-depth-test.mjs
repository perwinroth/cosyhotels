#!/usr/bin/env node
// Does 10 reviews score as well as 25? Re-scores the graded hotels with Haiku using the first 10
// vs first 25 of their already-CACHED reviews (no new Serper calls), correlates each to your grades.
// If 10 holds, the production recipe gets ~2.5x cheaper on both Serper and Haiku.
//   node --env-file=.env.local scripts/review-depth-test.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
const ANTHRO = process.env.ANTHROPIC_API_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const cache = existsSync("scripts/backups/review-cache.json") ? JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8")) : {};
const corr = (x, y) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
const PROMPT = (revs) => `You are a STRICT cosiness judge. From these guest reviews, rate how COSY the hotel actually is, 0-10.
COSY = warmth, intimacy, character, charm, warm lighting, fireplaces, natural materials, a homely intimate small-scale feel, warm personal service. NOT COSY = cold, corporate, sterile, large/impersonal, dated/run-down.
Judge from concrete things guests describe, not generic praise. Most hotels are 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy.
Reply ONLY JSON: {"cosy": <0-10 number>}
REVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function haiku(revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHRO, "anthropic-version": "2023-06-01", "content-type": "application/json" }, signal: AbortSignal.timeout(40000), body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 60, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const j = await r.json(); if (j.error) { if (a === 1) return null; continue; } const m = (j.content?.[0]?.text || "").match(/\{[\s\S]*\}/); return Math.max(0, Math.min(10, Number(JSON.parse(m[0]).cosy) || 0)); } catch { if (a === 1) return null; } } }

const { data: grades } = await db.from("hotel_grades").select("hotel_id,human_score");
const graded = (grades || []).filter((g) => typeof g.human_score === "number" && cache[String(g.hotel_id)]?.length >= 10);
console.log(`graded hotels with >=10 cached reviews: ${graded.length}\n`);
const out = [];
let n = 0;
for (const g of graded) {
  n++; const revs = cache[String(g.hotel_id)];
  const s10 = await haiku(revs.slice(0, 10));
  const s25 = await haiku(revs.slice(0, 25));
  if (s10 == null || s25 == null) continue;
  out.push({ grade: Number(g.human_score), s10, s25 });
  if (n % 15 === 0) console.log(`  ${n}/${graded.length}`);
}
const g = out.map((o) => o.grade);
console.log(`\nn=${out.length}`);
console.log(`Haiku @10 reviews vs grades:  ${corr(out.map((o) => o.s10), g).toFixed(3)}   MAE ${(out.reduce((s, o) => s + Math.abs(o.s10 - o.grade), 0) / out.length).toFixed(2)}`);
console.log(`Haiku @25 reviews vs grades:  ${corr(out.map((o) => o.s25), g).toFixed(3)}   MAE ${(out.reduce((s, o) => s + Math.abs(o.s25 - o.grade), 0) / out.length).toFixed(2)}`);
console.log(`(25-review Haiku in the bake-off ≈ 0.477)`);

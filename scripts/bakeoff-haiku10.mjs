#!/usr/bin/env node
// Scores the bake-off's graded hotels with Haiku at TWO review depths (first 10 and first 20 of the
// cached reviews) → bakeoff-extra.json so the leaderboard shows "Haiku @10" and "Haiku @20 (1 page)"
// as their own rows. 20 reviews ≈ what one Serper page returns = the cheap production recipe.
import { readFileSync, writeFileSync, existsSync } from "fs";
const ANTHRO = process.env.ANTHROPIC_API_KEY;
const cache = JSON.parse(readFileSync("scripts/backups/review-cache.json", "utf8"));
const rows = existsSync("scripts/backups/bakeoff.json") ? JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8")) : [];
const EXTRA = "scripts/backups/bakeoff-extra.json";
const extra = existsSync(EXTRA) ? JSON.parse(readFileSync(EXTRA, "utf8")) : {};
const PROMPT = (revs) => `You are a STRICT cosiness judge. From these guest reviews, rate how COSY the hotel actually is, 0-10.
COSY = warmth, intimacy, character, charm, warm lighting, fireplaces, natural materials, a homely intimate small-scale feel, warm personal service. NOT COSY = cold, corporate, sterile, large/impersonal, dated/run-down.
Judge from concrete things guests describe, not generic praise. Most hotels are 5-7; reserve 8-10 for genuinely cosy, 0-3 for clearly uncosy.
Reply ONLY JSON: {"cosy": <0-10 number>}
REVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function haiku(revs) { for (let a = 0; a < 2; a++) { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": ANTHRO, "anthropic-version": "2023-06-01", "content-type": "application/json" }, signal: AbortSignal.timeout(40000), body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 60, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const j = await r.json(); if (j.error) { if (a === 1) return null; continue; } const m = (j.content?.[0]?.text || "").match(/\{[\s\S]*\}/); return Math.max(0, Math.min(10, Number(JSON.parse(m[0]).cosy) || 0)); } catch { if (a === 1) return null; } } }
let n = 0;
for (const row of rows) {
  const cur = typeof extra[row.id] === "object" ? extra[row.id] : (typeof extra[row.id] === "number" ? { h10: extra[row.id] } : {});
  const revs = cache[row.id]; if (!revs || revs.length < 3) continue;
  if (cur.h10 == null) cur.h10 = await haiku(revs.slice(0, 10));
  if (cur.h20 == null) cur.h20 = await haiku(revs.slice(0, 20));
  extra[row.id] = cur; n++;
  if (n % 10 === 0) { writeFileSync(EXTRA, JSON.stringify(extra)); console.log(`  ${n} scored`); }
}
writeFileSync(EXTRA, JSON.stringify(extra));
console.log(`done — @10 and @20 scores for ${Object.keys(extra).length} hotels`);

#!/usr/bin/env node
// FREE pilot: scrape Google Maps reviews (Playwright, local, no API cost) for N photo-grounded
// hotels, score cosiness from the reviews with local Qwen ($0), correlate vs the photo-warmth.
// If correlation beats ~0.11 (today) / ~0.4 (strong), guest reviews are worth scaling.
//   node --env-file=.env.local scripts/review-pilot-scrape.mjs --n 3
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const N = Number(args.includes("--n") ? args[args.indexOf("--n") + 1] : 3);
const HEADED = args.includes("--headed");
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen2.5vl:7b";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

const grounded = [];
for (let off = 0; ; off += 1000) {
  const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999);
  if (!data?.length) break; grounded.push(...data); if (data.length < 1000) break;
}
const step = Math.max(1, Math.floor(grounded.length / N));
const sample = grounded.filter((_, i) => i % step === 0).slice(0, N);
const ids = sample.map((r) => String(r.hotel_id));
const warm = new Map(sample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));
const { data: hotels } = await db.from("hotels").select("id,name,city,country").in("id", ids);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));

const browser = await chromium.launch({ headless: !HEADED });
const ctx = await browser.newContext({ locale: "en-US", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" });
const page = await ctx.newPage();
let consentDone = false;
async function dismissConsent() {
  if (consentDone) return;
  try {
    const btn = await page.$('button[aria-label*="Accept all" i], button[aria-label*="Reject all" i], form[action*="consent"] button, button:has-text("Accept all"), button:has-text("Reject all")');
    if (btn) { await btn.click({ timeout: 4000 }); await page.waitForTimeout(1500); }
  } catch {}
  consentDone = true;
}
async function scrape(name, city) {
  const q = encodeURIComponent(`${name} ${city} hotel`);
  await page.goto(`https://www.google.com/maps/search/${q}?hl=en`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await dismissConsent();
  await page.waitForTimeout(2500);
  // If a result list appeared, click the first place.
  try { const first = await page.$('a.hfpxzc'); if (first) { await first.click(); await page.waitForTimeout(2500); } } catch {}
  // Open the Reviews tab.
  try { const tab = await page.$('button[aria-label*="Reviews" i], button[role="tab"]:has-text("Reviews")'); if (tab) { await tab.click(); await page.waitForTimeout(2000); } } catch {}
  // Scroll the reviews panel a few times to load more.
  for (let i = 0; i < 4; i++) { try { await page.mouse.wheel(0, 3000); await page.waitForTimeout(900); } catch {} }
  // Extract review text.
  const texts = await page.$$eval('.wiI7pd, .MyEned span', (els) => els.map((e) => e.textContent.trim()).filter((t) => t && t.length > 15));
  return [...new Set(texts)].slice(0, 8);
}

const PROMPT = (revs) => `You judge how COSY a hotel is from GUEST REVIEWS. Cosy = warmth, intimacy, character: warm lighting, fireplaces, soft furnishings, wood/stone, charm, a homely intimate feel. NOT cosy = cold, corporate, sterile, big/impersonal. Rate cosiness 0-10 from ONLY what guests describe. Reply ONLY JSON: {"cosy": <0-10>, "why":"<max 8 words>"}\n\nREVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) {
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(60000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) });
  const p = JSON.parse((await r.json()).message.content);
  return { cosy: Math.max(0, Math.min(10, Number(p.cosy) || 0)), why: String(p.why || "").slice(0, 50) };
}

const out = []; let noRev = 0;
for (const id of ids) {
  const h = hOf.get(id); if (!h) continue;
  let revs = [];
  try { revs = await scrape(h.name, h.city || ""); } catch (e) { console.log(`  scrape err ${h.name}: ${String(e.message).slice(0, 50)}`); }
  if (!revs.length) { noRev++; console.log(`  no reviews scraped: ${h.name}`); continue; }
  const s = await qwenScore(revs);
  out.push({ name: h.name, warmth: warm.get(id), reviewScore: s.cosy, nReviews: revs.length, why: s.why });
  console.log(`  warmth ${warm.get(id)}  reviewScore ${s.cosy}  (${revs.length} revs)  ${h.name.slice(0, 32)} — ${s.why}`);
}
await browser.close();

writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
console.log(`\nscraped+scored: ${out.length} · no-reviews: ${noRev}`);
if (out.length >= 5) console.log(`REVIEW-score vs PHOTO-warmth correlation: ${corr(out.map((o) => o.reviewScore), out.map((o) => o.warmth)).toFixed(3)}`);
else console.log("(small batch — just confirming the scraper pulls reviews; raise --n once it works)");

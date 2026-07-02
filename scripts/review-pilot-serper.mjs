#!/usr/bin/env node
// FREE pilot via Serper.dev (2,500 free credits): for N photo-grounded hotels, find the Google place
// (/places → cid), fetch its reviews (/reviews), score cosiness from the reviews with local Qwen ($0),
// correlate vs the photo-warmth (the truth). 2 credits/hotel. Verdict: does review text beat the
// current text model's 0.11 correlation with real cosiness?
//   node --env-file=.env.local scripts/review-pilot-serper.mjs --n 50
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const args = process.argv.slice(2);
const N = Number(args.includes("--n") ? args[args.indexOf("--n") + 1] : 50);
const KEY = process.env.SERPER_KEY;
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen2.5vl:7b";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!KEY) { console.error("✗ set SERPER_KEY in .env.local"); process.exit(1); }
const serper = async (path, body) => { const r = await fetch(`https://google.serper.dev/${path}`, { method: "POST", headers: { "X-API-KEY": KEY, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) }); return r.json(); };

const grounded = [];
for (let off = 0; ; off += 1000) { const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999); if (!data?.length) break; grounded.push(...data); if (data.length < 1000) break; }
const stepN = Math.max(1, Math.floor(grounded.length / N));
const sample = grounded.filter((_, i) => i % stepN === 0).slice(0, N);
const ids = sample.map((r) => String(r.hotel_id));
const warm = new Map(sample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));
const { data: hotels } = await db.from("hotels").select("id,name,city,country").in("id", ids);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));

async function reviewsFor(h) {
  const pl = await serper("places", { q: `${h.name} ${h.city || ""}`.trim() });
  if (pl.message) return { reviews: [], err: pl.message };
  const place = (pl.places || [])[0];
  if (!place?.cid) return { reviews: [], err: "no place" };
  const rv = await serper("reviews", { cid: String(place.cid) });
  if (rv.message) return { reviews: [], err: rv.message };
  const reviews = (rv.reviews || []).map((x) => (x.snippet || "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 15).slice(0, 12);
  return { reviews };
}

const PROMPT = (revs) => `You judge how COSY a hotel is from GUEST REVIEWS. Cosy = warmth, intimacy, character: warm lighting, fireplaces, soft furnishings, wood/stone, charm, a homely intimate feel. NOT cosy = cold, corporate, sterile, big/impersonal. Rate cosiness 0-10 from ONLY what guests describe. Reply ONLY JSON: {"cosy": <0-10>, "why":"<max 8 words>"}\n\nREVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(90000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) });
      const p = JSON.parse((await r.json()).message.content);
      return { cosy: Math.max(0, Math.min(10, Number(p.cosy) || 0)), why: String(p.why || "").slice(0, 38) };
    } catch (e) { if (attempt === 1) return null; }
  }
}

const out = []; let noRev = 0, qErr = 0;
for (const id of ids) {
  const h = hOf.get(id); if (!h) continue;
  try {
    const { reviews, err } = await reviewsFor(h);
    if (!reviews.length) { noRev++; console.log(`  no reviews (${err || "0"}): ${(h.name || "").slice(0, 32)}`); continue; }
    const s = await qwenScore(reviews);
    if (!s) { qErr++; console.log(`  qwen timeout: ${(h.name || "").slice(0, 32)}`); continue; }
    out.push({ name: h.name, warmth: warm.get(id), reviewScore: s.cosy, nReviews: reviews.length });
    console.log(`  photo ${warm.get(id)}  review ${s.cosy}  (${reviews.length})  ${(h.name || "").slice(0, 30).padEnd(30)} ${s.why}`);
    writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1)); // incremental so a crash never loses it
  } catch (e) { console.log(`  skip ${(h.name || "").slice(0, 30)}: ${String(e.message).slice(0, 40)}`); }
}
writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
const mae = out.length ? out.reduce((s, o) => s + Math.abs(o.reviewScore - o.warmth), 0) / out.length : 0;
console.log(`\nscored ${out.length} · no-reviews ${noRev}`);
if (out.length >= 10) {
  const c = corr(out.map((o) => o.reviewScore), out.map((o) => o.warmth));
  console.log(`\nREVIEW-score vs PHOTO-warmth:  correlation ${c.toFixed(3)}   MAE ${mae.toFixed(2)}   (today's text model corr = 0.11)`);
  console.log(c >= 0.4 ? "→ STRONG: reviews carry real cosiness signal. Worth scaling (~$0 on Serper free tier, then cheap)." : c >= 0.25 ? "→ MODERATE: reviews beat text but aren't decisive." : "→ WEAK: reviews don't beat text much. Launch lean.");
} else console.log("too few scored to correlate — raise --n.");

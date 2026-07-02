#!/usr/bin/env node
// FREE-ish pilot (~$0.40): fetch GUEST REVIEWS via DataForSEO for N photo-grounded hotels, score
// cosiness from the reviews with local Qwen ($0), correlate vs the photo-warmth (the truth).
// If correlation beats today's 0.11 (ideally >0.4), guest reviews are worth scaling (~$34 for all).
//   node --env-file=.env.local scripts/review-pilot-dfs.mjs --n 100 --depth 30
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const args = process.argv.slice(2);
const N = Number(args.includes("--n") ? args[args.indexOf("--n") + 1] : 100);
const DEPTH = Number(args.includes("--depth") ? args[args.indexOf("--depth") + 1] : 30);
const LOGIN = process.env.DATAFORSEO_LOGIN, PW = process.env.DATAFORSEO_PASSWORD;
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen2.5vl:7b";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!LOGIN || !PW) { console.error("✗ set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local"); process.exit(1); }
const AUTH = "Basic " + Buffer.from(`${LOGIN}:${PW}`).toString("base64");
const dfs = async (path, body) => {
  const r = await fetch(`https://api.dataforseo.com/v3${path}`, { method: body ? "POST" : "GET", headers: { Authorization: AUTH, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
};

// labelled sample, spread across the warmth range
const grounded = [];
for (let off = 0; ; off += 1000) { const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999); if (!data?.length) break; grounded.push(...data); if (data.length < 1000) break; }
const step = Math.max(1, Math.floor(grounded.length / N));
const sample = grounded.filter((_, i) => i % step === 0).slice(0, N);
const ids = sample.map((r) => String(r.hotel_id));
const warm = new Map(sample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));
const { data: hotels } = await db.from("hotels").select("id,name,city,country,lat,lng").in("id", ids);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));

// 1) post a reviews task per hotel (tag = hotel id so we can map results back)
console.log(`posting ${ids.length} review tasks (depth ${DEPTH})...`);
const tasks = ids.map((id) => { const h = hOf.get(id); if (!h) return null; const t = { keyword: `${h.name} ${h.city || ""}`.trim(), language_code: "en", depth: DEPTH, tag: id }; if (h.lat != null && h.lng != null) t.location_coordinate = `${h.lat},${h.lng}`; else t.location_name = `${h.city || ""},${h.country || ""}`; return t; }).filter(Boolean);
let posted = 0;
for (let i = 0; i < tasks.length; i += 100) { const res = await dfs("/business_data/google/reviews/task_post", tasks.slice(i, i + 100)); posted += (res.tasks || []).filter((t) => t.status_code === 20100).length; if (res.status_code !== 20000) console.log("  post warn:", res.status_message); }
console.log(`posted ${posted}/${tasks.length}. waiting for results (reviews take a few minutes to collect)...`);

// 2) poll until ready, collecting results by tag
const reviewsById = new Map(); const seenTask = new Set();
for (let round = 0; round < 30 && reviewsById.size < posted; round++) {
  await new Promise((r) => setTimeout(r, 20000));
  const ready = await dfs("/business_data/google/reviews/tasks_ready");
  const list = (ready.tasks || []).flatMap((t) => t.result || []);
  for (const r of list) {
    if (!r.id || seenTask.has(r.id)) continue; seenTask.add(r.id);
    const got = await dfs(`/business_data/google/reviews/task_get/${r.id}`);
    const res0 = got.tasks?.[0];
    const tag = res0?.data?.tag;
    const items = res0?.result?.[0]?.items || [];
    const texts = items.map((it) => (it.review_text || "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 15).slice(0, 12);
    if (tag) reviewsById.set(tag, texts);
  }
  console.log(`  ...${reviewsById.size}/${posted} ready`);
}

// 3) score cosiness from reviews with local Qwen, correlate vs photo-warmth
const PROMPT = (revs) => `You judge how COSY a hotel is from GUEST REVIEWS. Cosy = warmth, intimacy, character: warm lighting, fireplaces, soft furnishings, wood/stone, charm, a homely intimate feel. NOT cosy = cold, corporate, sterile, big/impersonal. Rate cosiness 0-10 from ONLY what guests describe. Reply ONLY JSON: {"cosy": <0-10>, "why":"<max 8 words>"}\n\nREVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) { const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(60000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const p = JSON.parse((await r.json()).message.content); return Math.max(0, Math.min(10, Number(p.cosy) || 0)); }

const out = []; let noRev = 0;
for (const id of ids) { const revs = reviewsById.get(id) || []; if (!revs.length) { noRev++; continue; } const cosy = await qwenScore(revs); out.push({ name: hOf.get(id)?.name, warmth: warm.get(id), reviewScore: cosy, nReviews: revs.length }); }
writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
console.log(`\nscored ${out.length} hotels · no-reviews ${noRev}`);
if (out.length >= 8) {
  const c = corr(out.map((o) => o.reviewScore), out.map((o) => o.warmth));
  console.log(`REVIEW-score vs PHOTO-warmth correlation: ${c.toFixed(3)}`);
  console.log(c >= 0.4 ? "→ STRONG: reviews carry real cosiness signal. Worth scaling (~$34 for all 9k)." : c >= 0.25 ? "→ MODERATE: reviews beat text (0.11) but aren't decisive — judgement call." : "→ WEAK: reviews don't predict cosiness much better than text. Don't scale; launch lean.");
} else console.log("too few scored — check task posting / raise --n");

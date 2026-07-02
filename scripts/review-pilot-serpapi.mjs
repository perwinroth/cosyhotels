#!/usr/bin/env node
// FREE pilot via SerpApi (100 searches/mo free): for N photo-grounded hotels, find the Google place,
// fetch its reviews, score cosiness from the reviews with local Qwen ($0), correlate vs photo-warmth.
// 2 SerpApi calls/hotel (place lookup + reviews), so keep N<=40 to stay in the free tier.
//   node --env-file=.env.local scripts/review-pilot-serpapi.mjs --n 40
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const args = process.argv.slice(2);
const N = Number(args.includes("--n") ? args[args.indexOf("--n") + 1] : 40);
const KEY = process.env.SERPAPI_KEY;
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen2.5vl:7b";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!KEY) { console.error("✗ set SERPAPI_KEY in .env.local"); process.exit(1); }

const serp = async (params) => { const u = new URL("https://serpapi.com/search.json"); for (const [k, v] of Object.entries({ ...params, api_key: KEY })) u.searchParams.set(k, v); const r = await fetch(u, { signal: AbortSignal.timeout(30000) }); return r.json(); };

const grounded = [];
for (let off = 0; ; off += 1000) { const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999); if (!data?.length) break; grounded.push(...data); if (data.length < 1000) break; }
const stepN = Math.max(1, Math.floor(grounded.length / N));
const sample = grounded.filter((_, i) => i % stepN === 0).slice(0, N);
const ids = sample.map((r) => String(r.hotel_id));
const warm = new Map(sample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));
const { data: hotels } = await db.from("hotels").select("id,name,city,country,lat,lng").in("id", ids);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));

async function reviewsFor(h) {
  // 1) locate the place → data_id
  const q = `${h.name} ${h.city || ""}`.trim();
  const ll = (h.lat != null && h.lng != null) ? `@${h.lat},${h.lng},15z` : undefined;
  const s = await serp({ engine: "google_maps", q, type: "search", hl: "en", ...(ll ? { ll } : {}) });
  if (s.error) return { reviews: [], err: s.error };
  const dataId = s.place_results?.data_id || s.local_results?.[0]?.data_id;
  if (!dataId) return { reviews: [], err: "no place match" };
  // 2) fetch reviews
  const rv = await serp({ engine: "google_maps_reviews", data_id: dataId, hl: "en" });
  if (rv.error) return { reviews: [], err: rv.error };
  const reviews = (rv.reviews || []).map((x) => (x.snippet || "").replace(/\s+/g, " ").trim()).filter((t) => t.length > 15).slice(0, 10);
  return { reviews };
}

const PROMPT = (revs) => `You judge how COSY a hotel is from GUEST REVIEWS. Cosy = warmth, intimacy, character: warm lighting, fireplaces, soft furnishings, wood/stone, charm, a homely intimate feel. NOT cosy = cold, corporate, sterile, big/impersonal. Rate cosiness 0-10 from ONLY what guests describe. Reply ONLY JSON: {"cosy": <0-10>, "why":"<max 8 words>"}\n\nREVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) { const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(60000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) }); const p = JSON.parse((await r.json()).message.content); return { cosy: Math.max(0, Math.min(10, Number(p.cosy) || 0)), why: String(p.why || "").slice(0, 40) }; }

const out = []; let noRev = 0;
for (const id of ids) {
  const h = hOf.get(id); if (!h) continue;
  const { reviews, err } = await reviewsFor(h);
  if (!reviews.length) { noRev++; console.log(`  no reviews (${err || "0"}): ${h.name.slice(0, 34)}`); continue; }
  const s = await qwenScore(reviews);
  out.push({ name: h.name, warmth: warm.get(id), reviewScore: s.cosy, nReviews: reviews.length });
  console.log(`  warmth ${warm.get(id)}  review ${s.cosy}  (${reviews.length} revs)  ${h.name.slice(0, 30).padEnd(30)} ${s.why}`);
}
writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
console.log(`\nscored ${out.length} · no-reviews ${noRev}`);
if (out.length >= 8) {
  const c = corr(out.map((o) => o.reviewScore), out.map((o) => o.warmth));
  console.log(`\nREVIEW-score vs PHOTO-warmth correlation: ${c.toFixed(3)}  (today's text model = 0.11)`);
  console.log(c >= 0.4 ? "→ STRONG: reviews carry real cosiness signal — worth scaling." : c >= 0.25 ? "→ MODERATE: reviews beat text but aren't decisive." : "→ WEAK: reviews don't beat text much. Launch lean.");
} else console.log("too few scored to correlate.");

#!/usr/bin/env node
// PILOT: does GUEST REVIEW TEXT predict cosiness better than the current text model (0.11)?
// For N photo-grounded hotels (we have the photo "truth" = imagery_warmth), fetch their Google
// reviews, score cosiness from the REVIEWS ALONE with local Qwen ($0), and correlate the
// review-score against the photo-warmth. If correlation beats ~0.3-0.4, reviews are worth scaling.
// Places review fetch is the only cost (~$0.04/hotel, likely $0 under Google's monthly free tier);
// scoring is local and free.
//   node --env-file=.env.local scripts/review-pilot.mjs --n 12
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const args = process.argv.slice(2);
const N = Number(args.includes("--n") ? args[args.indexOf("--n") + 1] : 12);
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = "qwen2.5vl:7b";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
if (!KEY) { console.error("✗ no GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY"); process.exit(1); }

// grounded hotels = our labelled set (photo warmth is the truth)
const grounded = [];
for (let off = 0; ; off += 1000) {
  const { data } = await db.from("cosy_scores").select("hotel_id,imagery_warmth").gt("imagery_warmth", 0).range(off, off + 999);
  if (!data?.length) break; grounded.push(...data); if (data.length < 1000) break;
}
// spread across the score range (every Kth) so the sample isn't all one warmth level
const step = Math.max(1, Math.floor(grounded.length / N));
const sample = grounded.filter((_, i) => i % step === 0).slice(0, N);
const ids = sample.map((r) => String(r.hotel_id));
const warm = new Map(sample.map((r) => [String(r.hotel_id), Number(r.imagery_warmth)]));
const { data: hotels } = await db.from("hotels").select("id,name,city,country,lat,lng").in("id", ids);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));

async function fetchReviews(name, city, lat, lng) {
  const body = { textQuery: `${name} ${city} hotel`, maxResultCount: 1 };
  if (lat != null && lng != null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 1000 } };
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "places.reviews.text,places.reviews.rating" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) return { reviews: [], err: `${r.status} ${(await r.text()).slice(0, 80)}` };
  const j = await r.json();
  const reviews = (j.places?.[0]?.reviews || []).map((x) => (x.text?.text || "").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 5);
  return { reviews };
}

const PROMPT = (revs) => `You judge how COSY a hotel is from GUEST REVIEWS. Cosy = warmth, intimacy, character: warm lighting, fireplaces, soft furnishings, wood/stone, charm, a homely intimate feel. NOT cosy = cold, corporate, sterile, big/impersonal. Read these guest reviews and rate the hotel's cosiness 0-10 based ONLY on what guests describe. Reply ONLY JSON: {"cosy": <0-10>, "why":"<max 8 words>"}\n\nREVIEWS:\n${revs.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
async function qwenScore(revs) {
  const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", signal: AbortSignal.timeout(60000), body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT(revs) }] }) });
  const p = JSON.parse((await r.json()).message.content);
  return { cosy: Math.max(0, Math.min(10, Number(p.cosy) || 0)), why: String(p.why || "").slice(0, 50) };
}

const out = []; let billed = 0, noRev = 0;
for (const id of ids) {
  const h = hOf.get(id); if (!h) continue;
  const { reviews, err } = await fetchReviews(h.name, h.city || "", h.lat, h.lng);
  billed++;
  if (err) { console.log(`  ERR ${h.name}: ${err}`); continue; }
  if (!reviews.length) { noRev++; console.log(`  no reviews: ${h.name}`); continue; }
  const s = await qwenScore(reviews);
  out.push({ name: h.name, warmth: warm.get(id), reviewScore: s.cosy, nReviews: reviews.length, why: s.why });
  console.log(`  warmth ${warm.get(id)}  reviewScore ${s.cosy}  (${reviews.length} revs)  ${h.name.slice(0, 30)} — ${s.why}`);
}

writeFileSync("scripts/backups/review-pilot.json", JSON.stringify(out, null, 1));
const corr = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; } return nu / Math.sqrt(dx * dy); };
console.log(`\nPlaces calls (billed): ${billed} · no-reviews: ${noRev} · scored: ${out.length}`);
if (out.length >= 5) console.log(`REVIEW-score vs PHOTO-warmth correlation: ${corr(out.map((o) => o.reviewScore), out.map((o) => o.warmth)).toFixed(3)}  (beat 0.11 = reviews add signal; >0.4 = strong)`);
else console.log("too few scored to correlate — raise --n");

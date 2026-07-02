#!/usr/bin/env node
// Estimate review-mapping contamination among live review-scored hotels with NO stored place id
// (scraped by the older fuzzy method; unverifiable offline). Random sample -> resolve each via
// Google Places IDs-only Text Search (free SKU) -> token-overlap vs place title -> LLM-judge the
// low-overlap ones -> report estimated contamination rate. READ-ONLY (report; no purge/hide).
//   node --env-file=.env.local scripts/sample-verify-reviews.mjs --n 120
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";

const N = Number(process.argv.includes("--n") ? process.argv[process.argv.indexOf("--n") + 1] : 120);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const GKEY = process.env.GOOGLE_MAPS_API_KEY;
if (!GKEY) { console.error("need GOOGLE_MAPS_API_KEY"); process.exit(1); }
const places = JSON.parse(readFileSync("scripts/backups/place-id-cache.json", "utf8"));

const rows = []; let off = 0;
for (;;) { const { data } = await db.from("cosy_scores").select("hotel_id").gte("score", 5).eq("notes", "review-scored:v2").range(off, off + 999); if (!data?.length) break; rows.push(...data); if (data.length < 1000) break; off += 1000; }
const unverified = rows.map((r) => String(r.hotel_id)).filter((id) => !places[id]);
// deterministic-ish shuffle without Math.random: hash order
const sample = unverified.map((id) => [id, id.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1e9, 7)]).sort((a, b) => a[1] - b[1]).slice(0, N).map(([id]) => id);
console.log(`live review-scored without stored place: ${unverified.length} · sampling ${sample.length}`);

const meta = new Map();
for (let i = 0; i < sample.length; i += 300) { const { data } = await db.from("hotels").select("id,name,name_en,city,country").in("id", sample.slice(i, i + 300)); for (const h of data || []) meta.set(String(h.id), h); }

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the","hotel","bed","and","breakfast","guest","house","guesthouse","inn","pension","b&b"]);
const toks = (s) => new Set(norm(s).split(" ").filter((t) => t.length > 2 && !STOP.has(t)));
const overlap = (a, b) => { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 1; let n = 0; for (const t of A) if (B.has(t)) n++; return n / Math.min(A.size, B.size); };

async function resolvePlace(h) {
  const q = [h.name_en || h.name, h.city, h.country].filter(Boolean).join(" ");
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GKEY, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress" }, body: JSON.stringify({ textQuery: q, maxResultCount: 1 }) }).then((r) => r.json());
    const p = r?.places?.[0];
    return p ? { title: p.displayName?.text || "", address: p.formattedAddress || "" } : null;
  } catch { return null; }
}
const SCHEMA = { type: "object", additionalProperties: false, properties: { same_property: { type: "boolean" }, reason: { type: "string" } }, required: ["same_property", "reason"] };
async function judge(h, p) {
  const prompt = `Are these the SAME lodging property? Consider transliteration, translation, rebranding, partial names. Strict.
A: "${h.name_en || h.name}" in ${[h.city, h.country].filter(Boolean).join(", ")}
B (Google Maps): "${p.title}" at ${p.address}
JSON: {"same_property": true|false, "reason": "<short>"}`;
  try {
    const r = await anthropic.messages.create({ model: "claude-haiku-4-5", max_tokens: 200, temperature: 0, messages: [{ role: "user", content: prompt }], output_config: { format: { type: "json_schema", schema: SCHEMA } } });
    return JSON.parse(r.content.find((b) => b.type === "text")?.text || "null");
  } catch { return null; }
}

let ok = 0, mismatch = 0, unresolved = 0; const bad = [];
let i = 0;
async function worker() {
  while (i < sample.length) {
    const id = sample[i++];
    const h = meta.get(id); if (!h) { unresolved++; continue; }
    const p = await resolvePlace(h);
    if (!p) { unresolved++; continue; }
    if (overlap(h.name_en || h.name, p.title) >= 0.5) { ok++; continue; }
    const v = await judge(h, p);
    if (v?.same_property === false) { mismatch++; bad.push({ id, name: h.name_en || h.name, city: h.city, place: p.title, reason: v.reason }); }
    else ok++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const rate = mismatch / Math.max(ok + mismatch, 1);
console.log(`\nsample ${sample.length}: verified-ok ${ok} · MISMATCH ${mismatch} · unresolved ${unresolved}`);
console.log(`estimated contamination among ${unverified.length} unverified: ${(rate * 100).toFixed(1)}% ≈ ${Math.round(rate * unverified.length)} hotels`);
bad.slice(0, 10).forEach((b) => console.log(`  ✗ ${b.name} (${b.city}) → ${b.place} — ${b.reason.slice(0, 60)}`));

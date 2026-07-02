#!/usr/bin/env node
// Photo-grounded 0-100 rescore for the vision-described live hotels. Their DESCRIPTION is grounded
// in a vetted photo, but their SCORE was still the old metadata-based one — the last ungrounded
// numbers on the live site. Same 0-100 anchors + calibration as rescore-granular for one scale.
//   node --env-file=.env.local scripts/rescore-vision.mjs             # dry-run
//   node --env-file=.env.local scripts/rescore-vision.mjs --execute   # real (backs up)
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, appendFileSync } from "fs";

const EXECUTE = process.argv.includes("--execute");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BACKUP = `scripts/backups/rescore-vision-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`;

let calA = 1, calB = 0;
try {
  const extra = JSON.parse(readFileSync("scripts/backups/bakeoff-extra.json", "utf8"));
  const bo = JSON.parse(readFileSync("scripts/backups/bakeoff.json", "utf8"));
  const pairs = bo.filter((r) => extra[r.id]?.h20 != null && typeof r.grade === "number").map((r) => [extra[r.id].h20, r.grade]);
  if (pairs.length >= 15) { const n = pairs.length, sx = pairs.reduce((s, p) => s + p[0], 0), sy = pairs.reduce((s, p) => s + p[1], 0), sxx = pairs.reduce((s, p) => s + p[0] * p[0], 0), sxy = pairs.reduce((s, p) => s + p[0] * p[1], 0); calA = (n * sxy - sx * sy) / (n * sxx - sx * sx); calB = (sy - calA * sx) / n; }
} catch {}
const calibrate = (h10) => Math.max(0, Math.min(10, Math.round((calA * h10 + calB) * 10) / 10));

const SCHEMA = { type: "object", additionalProperties: false, properties: { cosy100: { type: "integer" }, confidence: { type: "string", enum: ["low", "medium", "high"] } }, required: ["cosy100", "confidence"] };
const RUBRIC = `Score this hotel photo's COSINESS 0-100 with full granularity (any integer, not just multiples of 5). COSY = warmth, intimacy, character, warm lighting, fireplaces, natural materials, homely scale. Anchors: 80-100 exceptionally cosy, 65-79 clearly cosy, 50-64 pleasant with some warmth, 35-49 fine but impersonal, <35 cold/corporate. Judge ONLY what is visible.`;

const { data: rows } = await db.from("cosy_scores").select("hotel_id,score,score_final,score_100,review_sentiment,description,signals,confidence,score_model,notes,scored_at").gte("score", 5).eq("notes", "vision-described:v2");
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${rows?.length || 0} vision-described live hotels`);
const ids = (rows || []).map((r) => String(r.hotel_id));
const photo = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").in("hotel_id", ids.slice(i, i + 200)).eq("vision_ok", true);
  for (const im of data || []) { const u = im.url || ""; if (u && /^https:\/\/\S+\.(jpe?g|png|webp|gif)(\?|$)/i.test(u) && !photo.has(String(im.hotel_id))) photo.set(String(im.hotel_id), u); }
}
let rescored = 0, skipped = 0, failed = 0; const dist = new Map();
for (const r of rows || []) {
  const id = String(r.hotel_id);
  const url = photo.get(id);
  if (!url) { skipped++; continue; }
  try {
    const resp = await anthropic.messages.create({ model: "claude-haiku-4-5", max_tokens: 120, temperature: 0, messages: [{ role: "user", content: [{ type: "text", text: RUBRIC + "\nJSON: {\"cosy100\": <int>, \"confidence\": \"low|medium|high\"}" }, { type: "image", source: { type: "url", url } }] }], output_config: { format: { type: "json_schema", schema: SCHEMA } } });
    const j = JSON.parse(resp.content.find((b) => b.type === "text")?.text || "null");
    if (!j || typeof j.cosy100 !== "number") { failed++; continue; }
    const cal = calibrate(Math.max(0, Math.min(10, j.cosy100 / 10)));
    dist.set(cal, (dist.get(cal) || 0) + 1);
    if (EXECUTE) {
      appendFileSync(BACKUP, JSON.stringify(r) + "\n");
      const { error } = await db.from("cosy_scores").update({ score: cal, score_final: cal, score_100: Math.round(cal * 10), confidence: j.confidence, notes: "vision-scored:v3", scored_at: new Date().toISOString() }).eq("hotel_id", id);
      if (error) { failed++; continue; }
    }
    rescored++;
  } catch { failed++; }
}
console.log(`${EXECUTE ? "DONE" : "DRY-RUN"} · rescored ${rescored} · skipped(no photo) ${skipped} · failed ${failed} · distinct values ${dist.size}`);
if (EXECUTE) console.log(`backup: ${BACKUP}`);

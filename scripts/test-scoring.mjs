// Scoring trust test suite — the gate that proves the re-scoring pipeline works and stays
// working. Two kinds of test:
//   UNIT  (no DB): imageJunk heuristics behave (known junk flagged, real photos kept).
//   TRUST (live DB): invariants that define "trustworthy scoring":
//     T1  junk gate is active (some images rejected).
//     T2  NO hotel with a usable photo is over-scored (>=9) while still blind — the core
//         over-score invariant; a non-zero count is the pipeline's to-do list.
//     T3  golden-set MAE: current scores vs the 112 human grades, within tolerance.
// Exit code != 0 on any hard failure so it can gate a commit / CI / the pipeline loop.
//   node --env-file=.env.local scripts/test-scoring.mjs
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { junkByUrl, junkByImage } from "../src/lib/imageJunk.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
let fails = 0, passes = 0;
const ok = (name, cond, detail = "") => { if (cond) { passes++; console.log(`  ✓ ${name}`); } else { fails++; console.log(`  ✗ ${name}  ${detail}`); } };
const MAE_TOL = 2.0;

// ── UNIT: imageJunk.junkByUrl ──────────────────────────────────────────────
console.log("\nUNIT — junkByUrl (junk recognised):");
for (const u of ["https://h.com/fb.png", "https://h.com/wp/revslider/dummy.png", "https://h.com/ogp.jpg", "https://h.com/img/logo-2024.png", "https://h.com/banner-home6.jpg", "https://h.com/share-card.png", "https://h.com/crest.png", "https://placehold.co/600"])
  ok(`junk: ${u.split("/").pop()}`, junkByUrl(u).junk, "(should be junk)");
console.log("UNIT — junkByUrl (real photos kept):");
for (const u of ["https://h.com/uploads/2021/room-deluxe.jpg", "https://h.com/photos/suite-1200x800.jpg", "https://cdn.h.com/hotel-garden-terrace.webp", "https://h.com/media/restaurant-evening.jpeg"])
  ok(`real: ${u.split("/").pop()}`, !junkByUrl(u).junk, "(should be kept)");

// ── UNIT: imageJunk.junkByImage (synthetic bytes) ──────────────────────────
console.log("UNIT — junkByImage (pixels):");
const tiny = await sharp({ create: { width: 60, height: 60, channels: 3, background: { r: 120, g: 80, b: 40 } } }).jpeg().toBuffer();
ok("tiny 60x60 flagged", (await junkByImage(tiny)).junk);
const blank = await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 200, b: 200 } } }).jpeg().toBuffer();
ok("blank 800x600 flagged", (await junkByImage(blank)).junk);
const noise = Buffer.alloc(900 * 600 * 3);
for (let i = 0; i < noise.length; i++) noise[i] = (i * 1103515245 + 12345) % 256; // deterministic pseudo-noise → high variance
const realish = await sharp(noise, { raw: { width: 900, height: 600, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
ok("real 900x600 photo NOT flagged", !(await junkByImage(realish)).junk, `(reason ${(await junkByImage(realish)).reason})`);

// ── TRUST T1: junk gate active ─────────────────────────────────────────────
console.log("\nTRUST — live DB:");
const flagged = (await db.from("hotel_images").select("*", { count: "exact", head: true }).eq("vision_ok", false)).count ?? 0;
ok("T1 junk gate active (images rejected)", flagged > 0, `(${flagged} flagged)`);

// ── TRUST T2: no blind over-score has an unassessed usable photo ────────────
const { data: hi } = await db.from("cosy_scores").select("hotel_id").gte("score", 9).is("imagery_warmth", null);
const blindHi = (hi || []).map((r) => String(r.hotel_id));
const usable = new Set();
for (let i = 0; i < blindHi.length; i += 200) {
  const { data: imgs } = await db.from("hotel_images").select("hotel_id,url,vision_ok").in("hotel_id", blindHi.slice(i, i + 200));
  for (const im of imgs || []) { const u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co")) usable.add(String(im.hotel_id)); }
}
const blindOverWithPhoto = blindHi.filter((id) => usable.has(id)).length;
ok("T2 no blind ≥9 over-score has an unassessed usable photo", blindOverWithPhoto === 0, `(${blindOverWithPhoto} need re-scoring — pipeline to-do)`);

// ── TRUST T3: golden-set MAE within tolerance ──────────────────────────────
const { data: grades } = await db.from("hotel_grades").select("hotel_id,human_score").not("human_score", "is", null);
const gids = (grades || []).map((g) => String(g.hotel_id));
const humanOf = new Map((grades || []).map((g) => [String(g.hotel_id), Number(g.human_score)]));
const curOf = new Map();
for (let i = 0; i < gids.length; i += 200) {
  const { data: cs } = await db.from("cosy_scores").select("hotel_id,score,score_final").in("hotel_id", gids.slice(i, i + 200));
  for (const r of cs || []) curOf.set(String(r.hotel_id), typeof r.score_final === "number" ? r.score_final : r.score);
}
const pairs = gids.filter((id) => curOf.get(id) != null).map((id) => [humanOf.get(id), Number(curOf.get(id))]);
const mae = pairs.length ? pairs.reduce((s, [h, c]) => s + Math.abs(h - c), 0) / pairs.length : null;
ok(`T3 golden-set MAE ≤ ${MAE_TOL}`, mae != null && mae <= MAE_TOL, `(MAE ${mae == null ? "n/a" : mae.toFixed(2)} over ${pairs.length} graded)`);

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${fails === 0 ? "✓ ALL PASS" : "✗ FAIL"} — ${passes} passed, ${fails} failed`);
console.log(`metrics: junk-flagged=${flagged} · blind-over-with-photo=${blindOverWithPhoto} · golden-MAE=${mae == null ? "n/a" : mae.toFixed(2)} (n=${pairs.length})`);
process.exit(fails === 0 ? 0 : 1);

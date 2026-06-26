// Held-out (leave-one-out, grouped) evaluation of the cosy scorer's GENERALIZATION.
// For each graded hotel, re-score it with the REAL production scorer (claudeCosyScore) but with
// the hotel's OWN grade — and its near-twins (same dedup_key) — EXCLUDED from the calibration
// anchors. Then compare to the human grade. This is the honest MAE: the scorer never sees the
// answer for the hotel it's scoring. Costs ~1c/hotel (Sonnet, rubric cached). Spend-gated.
//   node --env-file=.env.local scripts/kfold-eval.mjs --limit 5      # smoke test (~5c)
//   node --env-file=.env.local scripts/kfold-eval.mjs                # full held-out (~$0.9)
//   node --env-file=.env.local scripts/kfold-eval.mjs --in-sample    # leaky baseline (for the delta)
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { claudeCosyScore } from "../src/lib/scoring/claudeCosy.ts";
import { fetchGradedProfiles, selectAnchorsFor, formatCalibration } from "../src/lib/scoring/calibration.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : d);
const LIMIT = flag("--limit", Infinity);
const CONC = flag("--conc", 4);
const HELD_OUT = !args.includes("--in-sample"); // default: exclude self (honest). --in-sample = leaky baseline.

const profiles = await fetchGradedProfiles(db);
const graded = profiles.filter((p) => p.humanScore != null);
const work = graded.slice(0, LIMIT === Infinity ? graded.length : LIMIT);
console.log(`${HELD_OUT ? "HELD-OUT (self excluded)" : "IN-SAMPLE (leaky baseline)"} eval · ${work.length} graded hotels · model ${process.env.COSY_SCORING_MODEL || "claude-sonnet-4-6"}\n`);

// full hotel rows + one usable photo each
const ids = work.map((p) => p.hotelId);
const hOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from("hotels").select("id,name,city,country,website,rating,reviews_count,rooms_count,amenities,description,stars").in("id", ids.slice(i, i + 200));
  for (const h of data || []) hOf.set(String(h.id), h);
}
const imgOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok,created_at").in("hotel_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
  for (const im of data || []) { const k = String(im.hotel_id), u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co") && !imgOf.has(k)) imgOf.set(k, u); }
}

const results = [];
let n = 0, errors = 0;
async function scoreOne(p) {
  const h = hOf.get(p.hotelId); if (!h) return;
  const anchors = selectAnchorsFor(
    { city: h.city, country: h.country, amenities: h.amenities, stars: h.stars },
    profiles, 12,
    HELD_OUT ? { hotelId: p.hotelId, dedupKey: p.dedupKey } : undefined,
  );
  try {
    const r = await claudeCosyScore({
      name: h.name ?? undefined, city: h.city ?? undefined, country: h.country ?? undefined, website: h.website ?? undefined,
      rating: h.rating ?? undefined, reviewsCount: h.reviews_count ?? undefined, roomsCount: h.rooms_count ?? undefined,
      amenities: (h.amenities) ?? undefined, description: h.description ?? undefined, stars: h.stars ?? undefined,
      imageUrls: imgOf.get(p.hotelId) ? [imgOf.get(p.hotelId)] : undefined,
      calibration: formatCalibration(anchors) || undefined,
    });
    const miss = Math.abs(Number(p.humanScore) - r.score10);
    results.push({ name: p.name, human: Number(p.humanScore), score: r.score10, miss });
    console.log(`${String(++n).padStart(3)}/${work.length}  human ${Number(p.humanScore).toFixed(1)}  scorer ${r.score10.toFixed(1)}  miss ${miss.toFixed(1)}  ${(p.name || "").slice(0, 36)}`);
  } catch (e) { errors++; console.log(`${String(++n).padStart(3)}/${work.length}  ERR ${(p.name || "").slice(0, 30)} — ${String(e.message).slice(0, 50)}`); }
}
for (let i = 0; i < work.length; i += CONC) await Promise.all(work.slice(i, i + CONC).map(scoreOne));

const mae = results.length ? results.reduce((s, r) => s + r.miss, 0) / results.length : null;
const within1 = results.filter((r) => r.miss <= 1).length, within2 = results.filter((r) => r.miss <= 2).length;
console.log(`\n── ${HELD_OUT ? "HELD-OUT" : "IN-SAMPLE"} RESULT ──`);
console.log(`scored ${results.length} (${errors} errors) · MAE ${mae == null ? "n/a" : mae.toFixed(2)} · within 1pt: ${results.length ? Math.round(100 * within1 / results.length) : 0}% · within 2pt: ${results.length ? Math.round(100 * within2 / results.length) : 0}%`);
if (results.length) {
  mkdirSync("scripts/backups", { recursive: true });
  const f = `scripts/backups/kfold-${HELD_OUT ? "heldout" : "insample"}-${process.env.STAMP || "run"}.json`;
  writeFileSync(f, JSON.stringify({ mae, results }, null, 2));
  console.log(`detail → ${f}`);
}

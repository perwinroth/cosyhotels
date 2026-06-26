// B's grade: does feeding friend-vote consensus into calibration make the scorer match the
// FRIEND PANEL better? Held-out: for each voted hotel, score it via the real claudeCosyScore with
// that hotel's own votes EXCLUDED from the anchors; correlate AI score with the friends' cosy-
// fraction. Run with --panel (owner grades + panel anchors) vs without (owner only) to isolate
// the effect. Grade: panel correlation ≥ 0.70 (baseline 0.56) AND ≥ the owner-only correlation.
//   node --import tsx --env-file=.env.local scripts/kfold-friends.mjs            # owner-only
//   node --import tsx --env-file=.env.local scripts/kfold-friends.mjs --panel    # owner + panel
import { createClient } from "@supabase/supabase-js";
import { claudeCosyScore } from "../src/lib/scoring/claudeCosy.ts";
import { fetchGradedProfiles, fetchPanelProfiles, selectAnchorsFor, formatCalibration } from "../src/lib/scoring/calibration.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const PANEL = process.argv.includes("--panel");
const CONC = 4;

const owner = await fetchGradedProfiles(db);
const panel = await fetchPanelProfiles(db);
const anchorPool = PANEL ? [...owner, ...panel] : [...owner];
console.log(`${PANEL ? "WITH panel" : "OWNER-only"} calibration · ${panel.length} voted hotels · ${owner.length} owner grades\n`);

// features + photo per voted hotel
const ids = panel.map((p) => p.hotelId);
const hOf = new Map(), imgOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from("hotels").select("id,name,city,country,website,rating,reviews_count,rooms_count,amenities,description,stars").in("id", ids.slice(i, i + 200));
  for (const h of data || []) hOf.set(String(h.id), h);
  const { data: im } = await db.from("hotel_images").select("hotel_id,url,vision_ok,created_at").in("hotel_id", ids.slice(i, i + 200)).order("created_at", { ascending: false });
  for (const r of im || []) { const k = String(r.hotel_id), u = r.url || ""; if (r.vision_ok !== false && u && !u.includes("placehold.co") && !imgOf.has(k)) imgOf.set(k, u); }
}

const rows = [];
let n = 0;
async function one(p) {
  const h = hOf.get(p.hotelId); if (!h) return;
  const anchors = selectAnchorsFor({ city: h.city, country: h.country, amenities: h.amenities, stars: h.stars }, anchorPool, 12, { hotelId: p.hotelId, dedupKey: p.dedupKey });
  try {
    const r = await claudeCosyScore({
      name: h.name ?? undefined, city: h.city ?? undefined, country: h.country ?? undefined, website: h.website ?? undefined,
      rating: h.rating ?? undefined, reviewsCount: h.reviews_count ?? undefined, roomsCount: h.rooms_count ?? undefined,
      amenities: h.amenities ?? undefined, description: h.description ?? undefined, stars: h.stars ?? undefined,
      imageUrls: imgOf.get(p.hotelId) ? [imgOf.get(p.hotelId)] : undefined,
      calibration: formatCalibration(anchors) || undefined,
    });
    const friendFrac = Number(p.humanScore) / 10; // 0..1
    rows.push({ name: p.name, ai: r.score10, friendFrac, friend10: Number(p.humanScore) });
    console.log(`${String(++n).padStart(2)}/${panel.length}  ai ${r.score10.toFixed(1)}  friends ${Math.round(friendFrac * 100)}% (${p.reasons[0]})  ${(p.name || "").slice(0, 30)}`);
  } catch (e) { console.log(`${String(++n).padStart(2)}  ERR ${(p.name || "").slice(0, 26)} — ${String(e.message).slice(0, 40)}`); }
}
for (let i = 0; i < panel.length; i += CONC) await Promise.all(panel.slice(i, i + CONC).map(one));

// correlation(ai, friendFrac) + MAE(ai, friend10)
const N = rows.length;
const mAi = rows.reduce((s, r) => s + r.ai, 0) / N, mF = rows.reduce((s, r) => s + r.friendFrac, 0) / N;
let cov = 0, va = 0, vf = 0; for (const r of rows) { cov += (r.ai - mAi) * (r.friendFrac - mF); va += (r.ai - mAi) ** 2; vf += (r.friendFrac - mF) ** 2; }
const corr = cov / Math.sqrt(va * vf);
const mae = rows.reduce((s, r) => s + Math.abs(r.ai - r.friend10), 0) / N;
console.log(`\n── ${PANEL ? "WITH PANEL" : "OWNER-ONLY"} ── n=${N}`);
console.log(`AI ↔ friend-consensus correlation: ${corr.toFixed(2)}  (baseline stored = 0.56)`);
console.log(`AI ↔ friend MAE: ${mae.toFixed(2)} points`);
console.log(`grade vs 0.70 target: ${corr >= 0.70 ? "✓ PASS" : "✗ below target"}`);

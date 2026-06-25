// Prepare a batch for SCORING-IN-SESSION (Claude Code, on the Max plan — $0 API).
// Read-only: pulls hotels that need a trustworthy re-score, downloads each one's real photo
// locally (so the assistant can actually SEE it), and bundles the structured signals + the
// owner's grade calibration. The assistant then reads scripts/_score_batch/batch.json + the
// images, applies SCORING_PROMPT.md, and proposes current → new. Writes are a separate,
// dry-run+backup step — this script never touches the DB.
//
//   node --env-file=.env.local scripts/score-here-batch.mjs --min-score 9 --limit 12 --offset 0
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import sharp from "sharp";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min-score", 9));
const LIMIT = Number(flag("--limit", 12));
const OFFSET = Number(flag("--offset", 0));
const OUT = "scripts/_score_batch";

// --- candidates: high score, scored blind (imagery_warmth null), ordered by score -----------
const { data: sc } = await db.from("cosy_scores")
  .select("hotel_id, score, score_final, signals, confidence, imagery_warmth")
  .gte("score", MIN).is("imagery_warmth", null)
  .order("score", { ascending: false });
const rows = sc || [];
const ids = rows.map((r) => String(r.hotel_id));

// --- usable image per hotel (most recent non-placeholder, not vision_ok=false) --------------
const imgOf = new Map();
for (let i = 0; i < ids.length; i += 200) {
  const { data: imgs } = await db.from("hotel_images")
    .select("hotel_id,url,vision_ok,created_at").in("hotel_id", ids.slice(i, i + 200))
    .order("created_at", { ascending: false });
  for (const im of imgs || []) {
    const u = im.url || ""; const k = String(im.hotel_id);
    if (im.vision_ok === false || !u || u.includes("placehold.co")) continue;
    if (!imgOf.has(k)) imgOf.set(k, u);
  }
}

// --- hotel facts ----------------------------------------------------------------------------
const withImg = ids.filter((id) => imgOf.has(id));
const pick = withImg.slice(OFFSET, OFFSET + LIMIT);
const { data: hotels } = await db.from("hotels")
  .select("id,name,name_en,city,country,stars,rooms_count,reviews_count,rating,amenities,website")
  .in("id", pick);
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));
const scOf = new Map(rows.map((r) => [String(r.hotel_id), r]));

// --- owner calibration: the graded hotels (your + friends' taste) ---------------------------
const { data: grades } = await db.from("hotel_grades")
  .select("cosy_verdict, human_score, ai_score, reasons, hotel:hotel_id!inner(name,name_en,city,country,amenities,stars)")
  .order("updated_at", { ascending: false }).limit(120);
const calibration = (grades || []).filter((g) => g.hotel).map((g) => ({
  name: String(g.hotel.name_en || g.hotel.name || "").trim(),
  city: g.hotel.city || "", country: g.hotel.country || "",
  verdict: g.cosy_verdict, human_score: g.human_score, ai_score: g.ai_score,
  reasons: g.reasons || [],
}));

// --- download photos so the assistant can SEE them ------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const batch = [];
let n = 0;
for (const id of pick) {
  n++;
  const h = hOf.get(id), s = scOf.get(id), url = imgOf.get(id);
  let imgFile = null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0" } });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      const fn = `${OUT}/${String(n).padStart(2, "0")}_${id}.jpg`;
      await sharp(buf).resize(900, 900, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(fn);
      imgFile = fn;
    }
  } catch { /* leave imgFile null — assistant scores it as image-failed */ }
  batch.push({
    n, hotel_id: id,
    name: String(h?.name_en || h?.name || "").trim(), city: h?.city || "", country: h?.country || "",
    stars: h?.stars ?? null, rooms_count: h?.rooms_count ?? null,
    reviews_count: h?.reviews_count ?? null, rating: h?.rating ?? null,
    amenities: h?.amenities || [], website: h?.website || "",
    current_score: typeof s?.score_final === "number" ? s.score_final : s?.score ?? null,
    current_confidence: s?.confidence || null,
    image_url: url, image_file: imgFile,
  });
  console.log(`${String(n).padStart(2)}/${pick.length}  ${(batch[n-1].current_score ?? "?").toString().padStart(4)}  ${(batch[n-1].name || "").slice(0,34).padEnd(34)} ${imgFile ? "img ok" : "IMG FAIL"}`);
}

writeFileSync(`${OUT}/batch.json`, JSON.stringify({ rubric_file: "SCORING_PROMPT.md", calibration, hotels: batch }, null, 2));
console.log(`\n${batch.length} hotels ready in ${OUT}/  ·  ${calibration.length} grade anchors  ·  candidates with photo: ${withImg.length} (offset ${OFFSET})`);
console.log("Next: assistant reads batch.json + the .jpg files, scores by SCORING_PROMPT.md, shows current → new.");

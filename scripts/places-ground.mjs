// Ground the VISIBLE no-photo hotels' scores using Google Places — fetch-and-DISCARD.
// For each hotel with score_final>=MIN and no usable photo: Find Place -> fetch one photo ->
// Qwen-7B warmth -> downward-only score correction -> store ONLY the score + imagery_warmth.
// The Places photo is NEVER stored or displayed (ToS-compliant: we keep the derived number only).
// Most blind tops are over-scores, so grounding pushes the photo-less ones down the rankings.
//   node --env-file=.env.local scripts/places-ground.mjs --min 7.5 --limit 12        # dry-run
//   node --env-file=.env.local scripts/places-ground.mjs --min 7.5 --execute         # apply (backup)
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import sharp from "sharp";

const KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const OLLAMA = process.env.OLLAMA_URL || "http://localhost:11434";
const args = process.argv.slice(2);
const EXECUTE = args.includes("--execute");
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MIN = Number(flag("--min", 7.5));
const LIMIT = Number(flag("--limit", 100000));
const MODEL = flag("--model", "qwen2.5vl:7b");
if (!KEY) { console.error("✗ no GOOGLE_MAPS_API_KEY"); process.exit(1); }

// visible no-photo hotels: score>=MIN AND no usable image
const usable = new Set(); let off = 0;
for (;;) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999); if (!data?.length) break;
  for (const im of data) { const u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co") && !u.startsWith("/api/places")) usable.add(String(im.hotel_id)); } if (data.length < 1000) break; off += 1000; }
const scored = []; off = 0;
for (;;) { const { data } = await db.from("cosy_scores").select("hotel_id,score,score_final").gte("score_final", MIN).range(off, off + 999); if (!data?.length) break;
  for (const r of data) { const id = String(r.hotel_id); if (!usable.has(id)) scored.push({ id, cur: typeof r.score_final === "number" ? r.score_final : Number(r.score || 0) }); } if (data.length < 1000) break; off += 1000; }
const work = scored.slice(0, LIMIT);
const { data: hotels } = await db.from("hotels").select("id,name,city,country").in("id", work.map((w) => w.id).slice(0, 1000));
const hOf = new Map((hotels || []).map((h) => [String(h.id), h]));
console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${work.length} visible no-photo hotels (score>=${MIN}) · Places fetch-and-discard\n`);

const PROMPT = `You assess a HOTEL photo for COSINESS. Cosy = warmth, intimacy, character: warm lighting, natural wood/stone/textiles, soft furnishings, fireplaces, plants, intimate human-scale spaces. Judge ANY genuine hotel space (room, lounge, restaurant, bar, lobby, garden, terrace, spa, or the building/setting). NOT cosy = cold/corporate/sterile, big impersonal lobbies. JUNK = not a usable photo of the hotel: a logo, icon, map, blank, collage with text, screenshot, or a bare portrait. Reply ONLY JSON: {"warmth": <0-10>, "is_hotel_space": <true if a real hotel space; false for logo/icon/map/blank/collage/screenshot/portrait>, "note":"<max 6 words>"}`;
async function vision(b64) { const r = await fetch(`${OLLAMA}/api/chat`, { method: "POST", body: JSON.stringify({ model: MODEL, format: "json", stream: false, options: { temperature: 0 }, messages: [{ role: "user", content: PROMPT, images: [b64] }] }) }); const p = JSON.parse((await r.json()).message.content); return { warmth: Math.max(0, Math.min(10, Number(p.warmth) || 0)), is_hotel_space: p.is_hotel_space !== false, note: String(p.note || "").slice(0, 30) }; }

async function placePhoto(h) {
  const u = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
  u.searchParams.set("input", `${h.name} ${h.city || ""} ${h.country || ""}`.trim()); u.searchParams.set("inputtype", "textquery"); u.searchParams.set("fields", "photos"); u.searchParams.set("key", KEY);
  const r = await fetch(u).then((x) => x.json());
  const ref = r.candidates?.[0]?.photos?.[0]?.photo_reference; if (!ref) return null;
  const pu = new URL("https://maps.googleapis.com/maps/api/place/photo"); pu.searchParams.set("photo_reference", ref); pu.searchParams.set("maxwidth", "800"); pu.searchParams.set("key", KEY);
  const pr = await fetch(pu, { redirect: "follow", signal: AbortSignal.timeout(15000) }); if (!pr.ok) return null;
  return await sharp(Buffer.from(await pr.arrayBuffer())).resize(768, 768, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer(); // photo lives in memory only, discarded after
}

const updates = []; let n = 0, noPlace = 0;
for (const w of work) {
  n++; const h = hOf.get(w.id); if (!h) continue;
  try {
    const buf = await placePhoto(h);
    if (!buf) { noPlace++; if (n <= 12 || EXECUTE) console.log(`${String(n).padStart(3)}  no place/photo  ${(h.name || "").slice(0, 32)}`); continue; }
    const v = await vision(buf.toString("base64"));
    let next = w.cur, flagJunk = false;
    if (!v.is_hotel_space) flagJunk = true; // junk Places photo: don't change score
    else { const blended = 0.4 * w.cur + 0.6 * v.warmth; next = Math.max(0, Math.min(w.cur, Math.round(blended * 10) / 10)); }
    updates.push({ id: w.id, name: h.name, cur: w.cur, warmth: v.warmth, space: v.is_hotel_space, next, flagJunk });
    if (n <= 12 || EXECUTE) console.log(`${String(n).padStart(3)}  ${w.cur.toFixed(1)} → ${next.toFixed(1)}  warmth ${v.warmth}${v.is_hotel_space ? "" : " JUNK(skip)"}  ${(h.name || "").slice(0, 30).padEnd(30)} ${v.note}`);
  } catch (e) { if (n <= 12) console.log(`${String(n).padStart(3)}  ERR ${(h.name || "").slice(0, 26)} — ${String(e.message).slice(0, 30)}`); }
}
const lowered = updates.filter((u) => !u.flagJunk && u.next < u.cur);
const raised = updates.filter((u) => u.next > u.cur);
console.log(`\nassessed ${updates.length} · lowered ${lowered.length} · confirmed ${updates.filter((u) => !u.flagJunk && u.next === u.cur).length} · junk-skipped ${updates.filter((u) => u.flagJunk).length} · no-place ${noPlace}`);
console.log(`downward-only: ${raised.length === 0 ? "✓ held" : "✗ " + raised.length + " RAISED"}`);
if (!EXECUTE) { console.log("\nDRY-RUN — no writes. The Places photos were used in-memory and discarded. Add --execute to ground (backup first)."); process.exit(0); }
mkdirSync("scripts/backups", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(`scripts/backups/places-ground-${stamp}.json`, JSON.stringify(updates.map(({ id, name, cur, next, warmth }) => ({ id, name, cur, next, warmth })), null, 2));
let done = 0;
for (const u of updates) {
  if (u.flagJunk) continue; // no real photo signal → leave the score
  // store ONLY the derived number — never the Places photo (ToS)
  const { error } = await db.from("cosy_scores").update({ score: u.next, score_final: u.next, imagery_warmth: u.warmth }).eq("hotel_id", u.id);
  if (!error) done++;
}
console.log(`\ndone — ${done} hotels grounded by a (discarded) Places photo (backup: scripts/backups/places-ground-${stamp}.json).`);

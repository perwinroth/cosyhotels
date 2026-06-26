// Live grading-progress dashboard. Run anytime to see exactly what's processed vs remaining:
//   node --env-file=.env.local scripts/grading-status.mjs
import { createClient } from "@supabase/supabase-js";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const cS = async (f) => { let q = db.from("cosy_scores").select("*", { count: "exact", head: true }); if (f) q = f(q); return (await q).count; };
const cI = async (f) => { let q = db.from("hotel_images").select("*", { count: "exact", head: true }); if (f) q = f(q); return (await q).count; };

// hotels with a usable (non-junk, non-placeholder, real) photo
const usable = new Set(); let off = 0;
for (;;) { const { data } = await db.from("hotel_images").select("hotel_id,url,vision_ok").range(off, off + 999); if (!data?.length) break;
  for (const im of data) { const u = im.url || ""; if (im.vision_ok !== false && u && !u.includes("placehold.co") && !u.startsWith("/api/places")) usable.add(String(im.hotel_id)); } if (data.length < 1000) break; off += 1000; }

const hotels = 18299;
const withPhoto = usable.size;
const grounded = await cS((q) => q.gt("imagery_warmth", 0));     // photo assessed by the Qwen engine
const ge9 = await cS((q) => q.gte("score_final", 9));
const junk = await cI((q) => q.eq("vision_ok", false));
const groundTarget = withPhoto;                                 // every photo'd hotel should be grounded
const groundRemaining = Math.max(0, groundTarget - grounded);

const bar = (done, total, w = 32) => { const f = total ? Math.round((done / total) * w) : 0; return "[" + "█".repeat(f) + "░".repeat(w - f) + "] " + (total ? Math.round((done / total) * 100) : 0) + "%"; };
console.log("\n════ GRADING STATUS — gotcosy.com ════\n");
console.log("THE UNIFIABLE SET (hotels with a real photo — the ones we can ground by ONE engine):");
console.log(`  Photo-grounded by Qwen   ${bar(grounded, groundTarget)}   ${grounded} / ${groundTarget}`);
console.log(`  Still to re-ground        ${groundRemaining} photo'd hotels (run: score-vision-local.mjs --all)\n`);
console.log("CAN'T BE PHOTO-UNIFIED (no usable photo — text-only score, must NOT be featured):");
console.log(`  No-photo hotels           ${hotels - withPhoto}  (${Math.round((hotels - withPhoto) / hotels * 100)}% of catalog) — Places can ground the visible few; rest stay provisional\n`);
console.log("CLEANUP & SAFETY:");
console.log(`  Junk images flagged       ${junk}`);
console.log(`  Over-scores >=9 remaining ${ge9}  (need re-grounding or to drop off featured surfaces)\n`);
console.log("GATE FOR GO-LIVE: every FEATURED/shown hotel is photo-grounded by Qwen, and no un-grounded");
console.log("hotel headlines. Photo-grounded coverage of the *shown* set is what must hit ~100%, not all 18k.\n");

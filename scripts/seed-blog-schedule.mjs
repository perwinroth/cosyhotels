// Seed the Supabase `blog_schedule` table with the initial drip plan.
// Run AFTER creating the table (supabase/2026_blog_schedule.sql).
// INSERT-IF-ABSENT only: never clobbers a status/date you've changed from /growth on your phone.
//   node scripts/seed-blog-schedule.mjs
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

// Drip plan: keep 2 live now, release the rest weekly. All reschedulable in /growth.
const PLAN = [
  { slug: "cosiest-hotels-for-solo-travellers", status: "live",      publish_at: null },
  { slug: "cosiest-hotels-for-a-workation",      status: "live",      publish_at: null },
  { slug: "cosiest-hotels-for-a-family-stay",    status: "scheduled", publish_at: "2026-07-08T00:00:00.000Z" },
  { slug: "cosiest-hotels-for-a-quiet-escape",   status: "scheduled", publish_at: "2026-07-15T00:00:00.000Z" },
  { slug: "are-hotel-chains-ever-cosy",          status: "scheduled", publish_at: "2026-07-22T00:00:00.000Z" },
  { slug: "how-to-make-any-hotel-room-feel-cosy", status: "scheduled", publish_at: "2026-07-29T00:00:00.000Z" },
];

const { data: existing, error: readErr } = await db.from("blog_schedule").select("slug");
if (readErr) { console.log("ERROR reading table: " + readErr.message); process.exit(1); }
const have = new Set((existing || []).map((r) => r.slug));
const toInsert = PLAN.filter((p) => !have.has(p.slug)).map((p) => ({ ...p, updated_at: new Date().toISOString() }));
if (!toInsert.length) { console.log("nothing to seed — all " + PLAN.length + " slugs already present (preserved)"); process.exit(0); }
const { error } = await db.from("blog_schedule").insert(toInsert);
console.log(error ? ("ERROR: " + error.message) : ("inserted " + toInsert.length + " new schedule rows (" + have.size + " already existed, preserved)"));
process.exit(error ? 1 : 0);

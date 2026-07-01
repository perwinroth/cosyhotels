// Seed / refresh the Supabase `outreach` table from scripts/backups/outreach.json.
// Run AFTER creating the table (supabase/2026_outreach.sql). Upserts by id, so re-running syncs
// new targets without clobbering statuses you've changed on the web.
//   node scripts/seed-outreach.mjs
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const list = JSON.parse(readFileSync("scripts/backups/outreach.json", "utf8"));

// Only insert rows that don't exist yet (preserve web-edited statuses); update metadata for existing.
const { data: existing } = await db.from("outreach").select("id,status");
const statusById = new Map((existing || []).map((r) => [r.id, r.status]));
const rows = list.map((o) => ({
  id: o.id, outlet: o.outlet, type: o.type, fit: o.fit, email: o.email || "",
  contact_route: o.contactRoute || "", region: o.region || "", notes: o.notes || "", rec: o.rec || null,
  status: statusById.get(o.id) || o.status || "queued", // keep any status already set on the web
}));
const { error } = await db.from("outreach").upsert(rows, { onConflict: "id" });
console.log(error ? ("ERROR: " + error.message) : ("upserted " + rows.length + " outreach targets (" + statusById.size + " already existed, statuses preserved)"));
process.exit(error ? 1 : 0);

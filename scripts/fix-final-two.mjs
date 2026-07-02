// One-off: hand-trimmed descriptions for the final 2 live rows whose copy meta-referenced reviews
// and resisted automated regeneration. Backed up before write.
import { createClient } from "@supabase/supabase-js";
import { appendFileSync } from "fs";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
const fixes = [
  ["59c94548-b64d-4b1d-887e-5d9915e3db5a", "Hôtel Pax offers warm, attentive service and a homely breakfast with fresh-made juice and coffee — a comfortable, well-run stay rather than a distinctively characterful one."],
  ["57fca9fb-ffcd-4e03-badf-b19374be6224", "A short walk from Vienna’s main station, Boutique Hotel Kolbeck pairs Paul’s reliably warm hospitality with light-filled rooms, fresh apples and lemon water at the entrance, and an unhurried à la carte breakfast — though standards vary between the boutique rooms and the older annexe."],
];
const BACKUP = "scripts/backups/fix-review-mention-manual-" + Date.now() + ".jsonl";
for (const [id, desc] of fixes) {
  const { data } = await db.from("cosy_scores").select("hotel_id,description").eq("hotel_id", id).maybeSingle();
  appendFileSync(BACKUP, JSON.stringify(data) + "\n");
  const { error } = await db.from("cosy_scores").update({ description: desc }).eq("hotel_id", id);
  console.log(id.slice(0, 8), error ? "ERR " + error.message : "fixed");
}
console.log("backup " + BACKUP);

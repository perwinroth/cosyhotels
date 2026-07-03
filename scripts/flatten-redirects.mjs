// Flatten hotel_slug_redirects so every old slug 301s DIRECTLY to the final live hotel slug — no
// chains, no loops, no rows shadowing a real hotel. Needed after the place-id strip migration, whose
// re-point step could turn a pre-existing redirect (old-clean-slug → place-id-slug) into a self-loop
// or a 2-hop once the place-id slug itself moved.
//
// Rules:
//   - DELETE a redirect whose old_slug is itself a current hotel slug (a real hotel lives there; the
//     redirect must never win, and it seeds chains/loops).
//   - DELETE a self-loop (old_slug == new_slug).
//   - Otherwise resolve new_slug by following the chain to a terminal (a hotel slug, or a dead end);
//     UPDATE new_slug to that terminal. DELETE if it resolves back to old_slug (loop).
//
// SAFE: dry-run default, backs up the FULL table before any write, reversible from the backup.
//   node --env-file=.env.local scripts/flatten-redirects.mjs            # DRY-RUN
//   node --env-file=.env.local scripts/flatten-redirects.mjs --execute
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
if (!SB_URL || !SB_KEY) { console.error("✗ need SUPABASE_URL + SERVICE_ROLE key"); process.exit(1); }
const db = createClient(SB_URL, SB_KEY);
const EXECUTE = process.argv.includes("--execute");
const PAGE = 1000;

(async () => {
  // Load all hotel slugs (any score — a redirect to a hidden hotel is still valid).
  const hotelSlugs = new Set();
  for (let from = 0; ; from += PAGE) {
    const { data } = await db.from("hotels").select("slug").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) if (r.slug) hotelSlugs.add(String(r.slug));
    if (data.length < PAGE) break;
  }
  // Load all redirects.
  const redir = new Map(); // old_slug -> new_slug
  for (let from = 0; ; from += PAGE) {
    const { data } = await db.from("hotel_slug_redirects").select("old_slug,new_slug").order("old_slug", { ascending: true }).range(from, from + PAGE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) redir.set(r.old_slug, r.new_slug);
    if (data.length < PAGE) break;
  }
  console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} · ${hotelSlugs.size} hotel slugs · ${redir.size} redirects`);

  // Resolve a slug to its terminal (hotel slug or dead end), following redirect hops with a loop guard.
  const resolve = (start) => {
    let cur = start; const seen = new Set([start]);
    for (let i = 0; i < 50; i++) {
      if (hotelSlugs.has(cur)) return cur;          // reached a real hotel
      if (!redir.has(cur)) return cur;              // dead end (no hotel, no further redirect)
      const nxt = redir.get(cur);
      if (seen.has(nxt)) return cur;                // loop
      seen.add(nxt); cur = nxt;
    }
    return cur;
  };

  const toDelete = [];
  const toUpdate = []; // { old_slug, new_slug }
  for (const [oldSlug, newSlug] of redir) {
    if (hotelSlugs.has(oldSlug)) { toDelete.push(oldSlug); continue; }   // shadows a real hotel
    if (oldSlug === newSlug) { toDelete.push(oldSlug); continue; }        // self-loop
    const final = resolve(newSlug);
    if (final === oldSlug) { toDelete.push(oldSlug); continue; }          // resolves back to itself
    if (final !== newSlug) toUpdate.push({ old_slug: oldSlug, new_slug: final });
  }
  console.log(`\nplan: delete ${toDelete.length}, re-point ${toUpdate.length}`);
  for (const d of toDelete.slice(0, 15)) console.log(`  DELETE ${d} → ${redir.get(d)}`);
  for (const u of toUpdate.slice(0, 15)) console.log(`  UPDATE ${u.old_slug}: ${redir.get(u.old_slug)} → ${u.new_slug}`);

  if (!EXECUTE) { console.log(`\nDRY-RUN — no writes. Re-run with --execute.`); return; }

  mkdirSync("scripts/backups", { recursive: true });
  writeFileSync("scripts/backups/flatten-redirects.json", JSON.stringify([...redir].map(([o, n]) => ({ old_slug: o, new_slug: n })), null, 0));
  console.log(`\nbacked up ${redir.size} redirect rows → scripts/backups/flatten-redirects.json`);

  let del = 0, upd = 0;
  for (const d of toDelete) { const { error } = await db.from("hotel_slug_redirects").delete().eq("old_slug", d); if (error) console.error(`  ✗ del ${d}: ${error.message}`); else del++; }
  for (const u of toUpdate) { const { error } = await db.from("hotel_slug_redirects").update({ new_slug: u.new_slug }).eq("old_slug", u.old_slug); if (error) console.error(`  ✗ upd ${u.old_slug}: ${error.message}`); else upd++; }
  console.log(`\n✓ deleted ${del}, re-pointed ${upd}. Redirects now single-hop, no loops, no shadowing.`);
})();

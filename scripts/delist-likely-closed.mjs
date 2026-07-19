// 2026-07-18 Stay22 likely-closed batch (die-validation Stay22 sweep, PRs #120-#122 mechanism).
// Sets hotels.delisted_at for the 52 slugs in data/likely-closed.json — layer 2 of the two-layer
// takedown described in src/lib/delisted.ts (layer 1, the code-level DELISTED_SLUGS Set, already
// covers these 52 the moment this PR merges; this script is the optional DB layer, same as
// sql/hotel-delist.sql was for brae-lodge). Idempotent: only sets delisted_at where it is
// currently null, so re-running never bumps an already-delisted row's timestamp. Dry-run by
// default; pass --execute to write. Requires the hotels.delisted_at column (sql/hotel-delist.sql)
// to already exist — if it does not, updates will no-op per-row and this script reports that.
//
// Run with: node --env-file=.env.local scripts/delist-likely-closed.mjs [--execute]
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
);
const EXECUTE = process.argv.includes("--execute");

// Read the slug list from the die-validation repo (sibling checkout) — same source of truth the
// PR's DELISTED_SLUGS addition was generated from. Falls back to an inline copy if that repo
// isn't present on this machine, so the script still runs standalone.
const INLINE_SLUGS = [
  "siri-guesthouse", "sonne-st-moritz", "salute-hotel-villa", "pa-18901-the-doylestown-inn",
  "bella-noche", "kokkelikoo", "oba-hotel", "jim-s-guesthouse", "eb-vloed", "hotel-aziyade",
  "alte-dorfaue", "abercorn-guest-house", "kleines-gastehaus-gro", "hotel-villa-am-schlosspark",
  "la-maison-munich", "the5rooms", "brindleys", "st-paul-s-lodge", "b-b-a-casa-di-virgilio",
  "adare-house", "agriturismo-fienile-del-canalone", "ratanga-lodge-guest-house", "verona-lodge",
  "urban-hideaway", "mountain-home-b-b", "nha-sanho-ven-song", "coconut-garden", "villa-acacia",
  "fort-aan-de-klop", "gastehaus-heidi-wei", "pension-diana", "strathblane-country-house",
  "redclyffe-house", "gelynis-farm-guest-house", "pension-nadal", "casa-mathilde-sintra",
  "antica-fattoria-b-b-la-verdina", "guesthouse-castello-di-brusata", "casa-del-1577",
  "hotel-villa-igiea", "hotel-le-prieure", "sternen-gernsbach", "biodelfico", "pada-lagos",
  "ny-10027-the-international-cozy-inn", "locanda-al-colle", "b-b-la-quiete",
  "luxury-suite-in-villa-with-private-pool-near-rome-and-ostia", "residenza-carracci",
  "bali-yoga", "villa-maria", "residencia-alvaro",
];

let slugs = INLINE_SLUGS;
try {
  const external = JSON.parse(
    readFileSync(new URL("../../die-validation/data/likely-closed.json", import.meta.url))
  );
  if (Array.isArray(external) && external.length) slugs = external;
} catch {
  // sibling repo not present on this machine — inline list stands
}

console.log(`${EXECUTE ? "EXECUTE" : "DRY-RUN"} — ${slugs.length} slugs to delist\n`);

let alreadyDelisted = 0;
let toDelist = 0;
let notFound = 0;
let errors = 0;

for (const slug of slugs) {
  const { data: row, error: selErr } = await db
    .from("hotels")
    .select("id,slug,delisted_at")
    .eq("slug", slug)
    .maybeSingle();

  if (selErr) {
    console.log(`  ERROR  ${slug}  (select failed: ${selErr.message})`);
    errors++;
    continue;
  }
  if (!row) {
    console.log(`  SKIP   ${slug}  (no hotels row for this slug — DELISTED_SLUGS Set still covers it)`);
    notFound++;
    continue;
  }
  if (row.delisted_at) {
    console.log(`  OK     ${slug}  (already delisted_at=${row.delisted_at})`);
    alreadyDelisted++;
    continue;
  }

  if (!EXECUTE) {
    console.log(`  WOULD-SET ${slug}`);
    toDelist++;
    continue;
  }

  const { error: updErr } = await db
    .from("hotels")
    .update({ delisted_at: new Date().toISOString() })
    .eq("slug", slug)
    .is("delisted_at", null); // idempotent: only ever sets it once
  if (updErr) {
    console.log(`  ERROR  ${slug}  (update failed: ${updErr.message})`);
    errors++;
  } else {
    console.log(`  SET    ${slug}`);
    toDelist++;
  }
}

console.log(
  `\n${EXECUTE ? "done" : "dry-run complete"} — ${toDelist} ${EXECUTE ? "set" : "would set"}, ${alreadyDelisted} already delisted, ${notFound} not found in hotels table, ${errors} errors.`
);
if (!EXECUTE) console.log("Add --execute to write. (DELISTED_SLUGS in src/lib/delisted.ts already filters these 52 regardless of whether this script ever runs.)");

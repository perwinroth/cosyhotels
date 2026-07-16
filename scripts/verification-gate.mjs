// Founder eyeball-verification gate (2026-07-16): a hotel may only be QUEUED into any outreach
// lane once a human has looked at its stored website and confirmed it via /growth/verify
// (hotel_verifications.founder_status = 'verified'). Shared by scripts/seed-email-outreach.mjs and
// scripts/seed-ig-outreach.mjs (raw REST, no Supabase client dependency in these plain .mjs
// scripts); src/lib/verificationGate.ts mirrors the same fail-closed contract for the Supabase-JS
// callers (outreach-sync cron).
//
// FAIL-CLOSED BY DESIGN: on ANY error (table missing, network failure, bad response) this returns
// `ok: false` and an EMPTY verified set. Never "couldn't check, so allow everything". Callers
// MUST treat ok:false as "process nothing" and log loudly; a missing migration must never be
// silently mistaken for "zero hotels verified yet" vs "the gate itself is broken", so both this
// helper and every caller print which case occurred.
export async function fetchVerifiedHotelIds(url, headers) {
  const PAGE = 1000;
  const ids = new Set();
  for (let from = 0; ; from += PAGE) {
    let r;
    try {
      r = await fetch(`${url}/rest/v1/hotel_verifications?select=hotel_id&founder_status=eq.verified`, {
        headers: { ...headers, Range: `${from}-${from + PAGE - 1}` },
      });
    } catch (e) {
      console.error(`✗ FAIL-CLOSED: hotel_verifications fetch threw: ${e.message}`);
      console.error("  Treating as ZERO verified hotels (network/DB unreachable).");
      return { ok: false, ids: new Set() };
    }
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error(`✗ FAIL-CLOSED: hotel_verifications query failed (HTTP ${r.status}): ${body}`);
      console.error("  Treating as ZERO verified hotels. Run sql/hotel-verifications.sql then scripts/import-link-verdicts.mjs --execute first.");
      return { ok: false, ids: new Set() };
    }
    const rows = await r.json();
    for (const row of rows) ids.add(String(row.hotel_id));
    if (rows.length < PAGE) break;
  }
  console.log(`verification gate: ${ids.size} hotel(s) founder-verified. Only these are eligible for outreach.`);
  return { ok: true, ids };
}

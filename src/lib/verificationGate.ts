// Founder eyeball-verification gate (2026-07-16): a hotel may only be advanced/contacted in any
// outreach lane once a human has confirmed its stored website via /growth/verify
// (hotel_verifications.founder_status = 'verified'). This is the Supabase-JS mirror of
// scripts/verification-gate.mjs's fail-closed contract, for callers that already hold a
// Supabase client (the outreach-sync cron). Keep both in sync if the contract changes.
//
// FAIL-CLOSED BY DESIGN: on ANY error (table missing, query error) this returns `ok: false` and an
// EMPTY verified set. Never "couldn't check, so allow everything". Callers MUST treat ok:false as
// "process nothing" and log/alert loudly.
import type { SupabaseClient } from "@supabase/supabase-js";

type DbLike = Pick<SupabaseClient, "from">;

export async function fetchVerifiedHotelIds(db: DbLike): Promise<{ ok: boolean; ids: Set<string>; error?: string }> {
  const ids = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("hotel_verifications")
      .select("hotel_id")
      .eq("founder_status", "verified")
      .range(from, from + PAGE - 1);
    if (error) {
      // Table missing (pre-migration) or any other query failure: fail closed, never fall back to
      // "process everything". Callers log this loudly (it must never read as "0 verified yet").
      return { ok: false, ids: new Set(), error: error.message };
    }
    const rows = (data || []) as Array<{ hotel_id: string }>;
    for (const r of rows) ids.add(String(r.hotel_id));
    if (rows.length < PAGE) break;
  }
  return { ok: true, ids };
}

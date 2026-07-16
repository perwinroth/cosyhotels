// Founder eyeball-verification board + outreach gate (2026-07-16). Regression suite for the
// fail-closed contract (a broken/missing hotel_verifications table must stop ALL outreach, never
// silently allow it) and the board's default sort priority. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SITE_URL = "https://gotcosy.com";

import { fetchVerifiedHotelIds as fetchVerifiedHotelIdsDb } from "../src/lib/verificationGate";
import { priorityRank, SEVERE_VERDICTS } from "../src/lib/hotelVerificationBoard";
import { fetchVerifiedHotelIds as fetchVerifiedHotelIdsRest } from "../scripts/verification-gate.mjs";

// ── src/lib/verificationGate.ts (Supabase-JS caller: outreach-sync cron) ──

test("fetchVerifiedHotelIds (db) FAILS CLOSED (ok:false, empty set) when the query errors", async () => {
  const erroringDb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                range: async () => ({ data: null, error: { message: 'relation "hotel_verifications" does not exist' } }),
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof fetchVerifiedHotelIdsDb>[0];
  const result = await fetchVerifiedHotelIdsDb(erroringDb);
  assert.equal(result.ok, false);
  assert.equal(result.ids.size, 0);
  assert.match(result.error || "", /does not exist/);
});

test("fetchVerifiedHotelIds (db) returns exactly the verified hotel_ids on success", async () => {
  let called = 0;
  const okDb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                range: async () => {
                  called++;
                  // First page full (simulates >1000 rows would page again); here <1000 so it stops.
                  return { data: [{ hotel_id: "a" }, { hotel_id: "b" }], error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof fetchVerifiedHotelIdsDb>[0];
  const result = await fetchVerifiedHotelIdsDb(okDb);
  assert.equal(result.ok, true);
  assert.deepEqual([...result.ids].sort(), ["a", "b"]);
  assert.equal(called, 1, "stops paging once a short page comes back");
});

// ── scripts/verification-gate.mjs (raw REST caller: the two seed scripts) ──

test("fetchVerifiedHotelIds (REST) FAILS CLOSED when the table is missing (non-ok response)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("relation does not exist", { status: 404 })) as typeof fetch;
  try {
    const result = await fetchVerifiedHotelIdsRest("https://x.supabase.co", { apikey: "k" });
    assert.equal(result.ok, false);
    assert.equal(result.ids.size, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchVerifiedHotelIds (REST) FAILS CLOSED when the network call throws", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch;
  try {
    const result = await fetchVerifiedHotelIdsRest("https://x.supabase.co", { apikey: "k" });
    assert.equal(result.ok, false);
    assert.equal(result.ids.size, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("fetchVerifiedHotelIds (REST) returns the verified set on success", async () => {
  const realFetch = globalThis.fetch;
  let n = 0;
  globalThis.fetch = (async () => {
    n++;
    return new Response(JSON.stringify(n === 1 ? [{ hotel_id: "h1" }, { hotel_id: "h2" }] : []), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await fetchVerifiedHotelIdsRest("https://x.supabase.co", { apikey: "k" });
    assert.equal(result.ok, true);
    assert.deepEqual([...result.ids].sort(), ["h1", "h2"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ── src/lib/hotelVerificationBoard.ts: the founder-priority sort ──

test("priorityRank: queued hotels always sort first, regardless of verdict", () => {
  assert.equal(priorityRank({ queued: true, autoVerdict: null }), 0);
  assert.equal(priorityRank({ queued: true, autoVerdict: "SAME_HOTEL" }), 0);
});

test("priorityRank: severe verdicts (DIFFERENT/HIJACKED/CITY_MISMATCH) rank above INSUFFICIENT_EVIDENCE, which ranks above everything else", () => {
  for (const v of SEVERE_VERDICTS) {
    assert.equal(priorityRank({ queued: false, autoVerdict: v }), 1, `${v} must rank 1`);
  }
  assert.equal(priorityRank({ queued: false, autoVerdict: "INSUFFICIENT_EVIDENCE" }), 2);
  assert.equal(priorityRank({ queued: false, autoVerdict: "SAME_HOTEL" }), 3);
  assert.equal(priorityRank({ queued: false, autoVerdict: "SAME_GROUP" }), 3);
  assert.equal(priorityRank({ queued: false, autoVerdict: "MODEL_ERROR" }), 3);
  assert.equal(priorityRank({ queued: false, autoVerdict: null }), 3);
});

test("priorityRank: a sorted list puts queued, then severe, then insufficient-evidence, then the rest, in order", () => {
  const rows = [
    { queued: false, autoVerdict: "SAME_HOTEL" },
    { queued: false, autoVerdict: "DIFFERENT" },
    { queued: true, autoVerdict: "SAME_HOTEL" },
    { queued: false, autoVerdict: "INSUFFICIENT_EVIDENCE" },
    { queued: false, autoVerdict: "HIJACKED" },
  ];
  const sorted = [...rows].sort((a, b) => priorityRank(a) - priorityRank(b));
  assert.deepEqual(
    sorted.map((r) => (r.queued ? "queued" : r.autoVerdict)),
    ["queued", "DIFFERENT", "HIJACKED", "INSUFFICIENT_EVIDENCE", "SAME_HOTEL"],
  );
});

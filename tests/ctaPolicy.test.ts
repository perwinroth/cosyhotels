// Booking-CTA policy (founder FINAL rule, 2026-07-16, verbatim intent: "website only when Stay22 is
// wrong, so you need to know"). Single source of truth: src/lib/ctaPolicy.ts resolveBookingCta +
// getStay22WrongSlugs, used by every listing card + the hotel detail page (via HotelActions) so the
// swap is measurable via data-cta and never drifts surface-to-surface. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBookingCta, getStay22WrongSlugs } from "../src/lib/ctaPolicy";

const STAY22 = "https://www.stay22.com/allez/roam?aid=x&hotelname=Brae+Lodge";
const REAL_WEBSITE = "https://www.braelodge.com/";

// ── resolveBookingCta: DEFAULT (isVerifiedWrong omitted/false) — pre-existing behaviour, unchanged ─
// The whole point of the FINAL rule: a hotel the sweep hasn't verified wrong (no row, PENDING,
// EXACT, SELECTED) must render EXACTLY what it always has, Stay22 "Check availability", REGARDLESS
// of whether it happens to carry a real website.

test("resolveBookingCta defaults to Stay22 'Check availability' when isVerifiedWrong is omitted, even with a real website", () => {
  const cta = resolveBookingCta(REAL_WEBSITE, STAY22);
  assert.equal(cta.mode, "stay22");
  assert.equal(cta.href, STAY22);
  assert.equal(cta.label, "Check availability");
  assert.equal(cta.dataCta, "check_availability");
  assert.equal(cta.rel, "noopener nofollow sponsored");
});

test("resolveBookingCta defaults to Stay22 'Check availability' when isVerifiedWrong is explicitly false", () => {
  for (const website of [REAL_WEBSITE, null, undefined, "", "not a url"]) {
    const cta = resolveBookingCta(website, STAY22, false);
    assert.equal(cta.mode, "stay22");
    assert.equal(cta.dataCta, "check_availability");
    assert.equal(cta.label, "Check availability");
  }
});

// ── resolveBookingCta: VERIFIED-WRONG (isVerifiedWrong = true) — the only case that swaps ──────────

test("resolveBookingCta swaps to the hotel's own website only when verified wrong AND it has a real website", () => {
  const cta = resolveBookingCta(REAL_WEBSITE, STAY22, true);
  assert.equal(cta.mode, "website");
  assert.equal(cta.href, REAL_WEBSITE);
  assert.equal(cta.label, "Visit hotel website");
  assert.equal(cta.dataCta, "hotel_website");
  assert.equal(cta.rel, "noopener nofollow");
});

test("resolveBookingCta falls back to Stay22, relabelled 'Check nearby stays', when verified wrong but no real website", () => {
  for (const website of [null, undefined, "", "not a url", "https://www.booking.com/hotel/gb/x.html"]) {
    const cta = resolveBookingCta(website, STAY22, true);
    assert.equal(cta.mode, "stay22");
    assert.equal(cta.href, STAY22);
    assert.equal(cta.label, "Check nearby stays");
    assert.equal(cta.dataCta, "check_nearby");
    assert.equal(cta.rel, "noopener nofollow sponsored");
  }
});

test("resolveBookingCta never renders BOTH a website and a Stay22 button (single CTA, mutually exclusive)", () => {
  const withSite = resolveBookingCta(REAL_WEBSITE, STAY22, true);
  const withoutSite = resolveBookingCta(null, STAY22, true);
  assert.notEqual(withSite.mode, withoutSite.mode);
  assert.equal(typeof withSite.href, "string");
  assert.equal(typeof withoutSite.href, "string");
});

// ── getStay22WrongSlugs: the fail-safe helper ────────────────────────────────────────────────────
// ttlMs=0 forces a fresh fetch on every call in these tests, so each test's mock db is actually
// queried rather than serving a previous test's cached result (the module cache is shared for the
// lifetime of this test file's process).

test("getStay22WrongSlugs returns an empty set with no db client at all (works pre-migration)", async () => {
  assert.deepEqual(await getStay22WrongSlugs(undefined, 0), new Set());
  assert.deepEqual(await getStay22WrongSlugs(null, 0), new Set());
});

test("getStay22WrongSlugs fails safe to an empty set when the query errors (e.g. missing table)", async () => {
  const erroringDb = {
    from() {
      return {
        async select() {
          return { data: null, error: { message: 'relation "stay22_checks" does not exist' } };
        },
      };
    },
  } as unknown as Parameters<typeof getStay22WrongSlugs>[0];
  assert.deepEqual(await getStay22WrongSlugs(erroringDb, 0), new Set());
});

test("getStay22WrongSlugs fails safe to an empty set when the query throws", async () => {
  const throwingDb = {
    from() {
      return {
        async select(): Promise<never> {
          throw new Error("network error");
        },
      };
    },
  } as unknown as Parameters<typeof getStay22WrongSlugs>[0];
  assert.deepEqual(await getStay22WrongSlugs(throwingDb, 0), new Set());
});

test("getStay22WrongSlugs returns only the WRONG_PROPERTY/CITY_SEARCH/UNMATCHED_SEARCH slugs, never EXACT/SELECTED/PENDING", async () => {
  const rows = [
    { slug: "brae-lodge", verdict: "WRONG_PROPERTY" },
    { slug: "robyns-inn", verdict: "WRONG_PROPERTY" },
    { slug: "ariel-house", verdict: "CITY_SEARCH" },
    { slug: "black-stork-house", verdict: "UNMATCHED_SEARCH" },
    { slug: "hotel-isa", verdict: "EXACT" },
    { slug: "hotel-casa-1800", verdict: "SELECTED" },
    { slug: "babington-house", verdict: "PENDING" },
    { slug: "unchecked-hotel", verdict: null },
  ];
  const workingDb = {
    from(table: string) {
      assert.equal(table, "stay22_checks");
      return {
        async select() {
          return { data: rows, error: null };
        },
      };
    },
  } as unknown as Parameters<typeof getStay22WrongSlugs>[0];
  const slugs = await getStay22WrongSlugs(workingDb, 0);
  assert.deepEqual(slugs, new Set(["brae-lodge", "robyns-inn", "ariel-house", "black-stork-house"]));
  assert.equal(slugs.has("hotel-isa"), false);
  assert.equal(slugs.has("hotel-casa-1800"), false);
  assert.equal(slugs.has("babington-house"), false);
  assert.equal(slugs.has("unchecked-hotel"), false);
});

test("getStay22WrongSlugs caches within the TTL window: a later call with a different db does not override an unexpired cache", async () => {
  const seedDb = {
    from() {
      return { async select() { return { data: [{ slug: "seed-hotel", verdict: "WRONG_PROPERTY" }], error: null }; } };
    },
  } as unknown as Parameters<typeof getStay22WrongSlugs>[0];
  // ttlMs=0 forces THIS call to fetch fresh, pinning the cache to seedDb's data + "now".
  const seeded = await getStay22WrongSlugs(seedDb, 0);
  assert.deepEqual(seeded, new Set(["seed-hotel"]));

  let otherCalled = false;
  const otherDb = {
    from() {
      otherCalled = true;
      return { async select() { return { data: [{ slug: "other-hotel", verdict: "WRONG_PROPERTY" }], error: null }; } };
    },
  } as unknown as Parameters<typeof getStay22WrongSlugs>[0];
  // A huge ttl relative to the microseconds since the seed call above — must serve the cached value.
  const stillCached = await getStay22WrongSlugs(otherDb, 10 * 60 * 1000);
  assert.equal(otherCalled, false);
  assert.deepEqual(stillCached, seeded);
});

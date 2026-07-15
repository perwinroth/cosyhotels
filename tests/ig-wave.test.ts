// Instagram badge wave (Challenger-passed 2026-07-11): the contracts the DM texts, tier ladder,
// percentile rounding, seeder exclusions and asset page must keep. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_SITE_URL = "https://gotcosy.com";

import { buildVariantDm, tierForScore, roundPctUp, buildVariantPitch } from "../src/lib/badgePitch";
import { CONTROL_MARKETS } from "../src/lib/controlMarkets";
// The seeder's pure exports (module is side-effect free on import; network code is main-guarded).
import { IG_CONTROL_CITIES, isIgControlCity, pctTopFor } from "../scripts/seed-ig-outreach.mjs";

const SAMPLE = {
  name: "Hotel Alma",
  score: 6.8,
  pct: 9,
  evidence: "log fire in the lounge and thick blankets",
  assetLink: "https://gotcosy.com/for-hotels/assets/hotel-alma",
};

// ── (a) buildVariantDm: exact approved texts, one link, opt-out, unquoted evidence ──

test("v2 DM matches the approved text exactly", () => {
  assert.equal(
    buildVariantDm("v2", SAMPLE),
    `Hotel Alma scored 6.8/10 for cosiness: top 9% of the 17,727 hotels we've analysed from guest reviews.

What guests keep mentioning, condensed from their reviews: log fire in the lounge and thick blankets.

We made you a free ready-to-post graphic with it, nothing to buy, nothing asked: https://gotcosy.com/for-hotels/assets/hotel-alma

I'm Per, I run Got Cosy. If you'd rather not hear from us, just reply "no thanks" and we won't write again.`,
  );
});

test("v3 DM matches the approved text exactly", () => {
  assert.equal(
    buildVariantDm("v3", SAMPLE),
    `Hotel Alma scored 6.8/10 for cosiness in our review-language analysis of 17,727 hotels: top 9% of them.

The method is public, and this page has the evidence from your own guests plus a free ready-to-post graphic: https://gotcosy.com/for-hotels/assets/hotel-alma

Happy to answer anything about how the score works. If you'd rather not hear from us, just reply "no thanks" and we won't write again.`,
  );
});

test("both DMs carry exactly ONE http link, the opt-out sentence, and never quote the evidence", () => {
  for (const v of ["v2", "v3"] as const) {
    const dm = buildVariantDm(v, SAMPLE);
    assert.equal((dm.match(/https?:\/\//g) || []).length, 1, `${v}: exactly one link`);
    assert.ok(dm.includes(`If you'd rather not hear from us, just reply "no thanks" and we won't write again.`), `${v}: opt-out present`);
    assert.ok(!dm.includes(`"${SAMPLE.evidence}"`), `${v}: evidence must not be wrapped in quotes`);
    // The ONLY double quotes in a DM are the pair around "no thanks".
    assert.equal((dm.match(/"/g) || []).length, 2, `${v}: no stray quote marks`);
  }
});

test("stamped totals flow into the DM; trailing evidence punctuation never doubles the full stop", () => {
  const dm = buildVariantDm("v2", { ...SAMPLE, total: 18102, evidence: "warm staff and soft lighting." });
  assert.ok(dm.includes("the 18,102 hotels"), "stamped_total is rendered, formatted");
  assert.ok(dm.includes("warm staff and soft lighting.\n\nWe made you"), "no double full stop");
  assert.ok(!dm.includes(".."), "no doubled punctuation anywhere");
});

// ── (b) tierForScore boundaries ──

test("tier ladder boundaries are exact", () => {
  assert.deepEqual(tierForScore(7.0), { key: "index", label: "Cosy Index" });
  assert.deepEqual(tierForScore(6.99), { key: "top16", label: "Rated Cosy · Top 16%" });
  assert.deepEqual(tierForScore(6.5), { key: "top16", label: "Rated Cosy · Top 16%" });
  assert.deepEqual(tierForScore(6.49), { key: "top27", label: "Rated Cosy · Top 27%" });
  assert.deepEqual(tierForScore(6.0), { key: "top27", label: "Rated Cosy · Top 27%" });
  assert.equal(tierForScore(5.99), null);
});

// ── (c) percentile rounding: always UP (the claim may only understate) ──

test("roundPctUp rounds up, never down", () => {
  assert.equal(roundPctUp(5.7), 6);
  assert.equal(roundPctUp(5.01), 6);
  assert.equal(roundPctUp(6), 6);
  assert.equal(roundPctUp(0.2), 1);
});

test("the seeder's pctTopFor ranks at-or-above and rounds up", () => {
  const scores = [5.0, 6.0, 6.5, 7.0, 8.0, 9.0].sort((a, b) => a - b);
  assert.equal(pctTopFor(9.0, scores), Math.ceil(100 / 6)); // 1 of 6 at-or-above → 17
  assert.equal(pctTopFor(6.5, scores), Math.ceil((100 * 4) / 6)); // 4 of 6 → 67
  assert.equal(pctTopFor(5.0, scores), 100);
});

// ── (d) control-market exclusion: EXACT match, never substring (the York/New York hazard) ──

test("seeder excludes exactly the declared control cities — and never New York", () => {
  assert.equal(isIgControlCity("York"), true, "York (Bruges-pilot control) excluded");
  assert.equal(isIgControlCity("New York"), false, "New York must NOT be excluded (exact match, not substring)");
  assert.equal(isIgControlCity("Savannah"), true, "Savannah (GSC control) excluded");
  assert.equal(isIgControlCity("Fez"), true, "Fez (Marrakech 001 control) excluded");
  assert.equal(isIgControlCity("Venice-historic"), true, "Venice-historic (Bruges-pilot control) excluded");
  assert.equal(isIgControlCity("Venice historic"), true, "whitespace-normalised variant excluded");
  assert.equal(isIgControlCity("Bruges"), false);
  assert.equal(isIgControlCity(null), false);
});

test("the seeder's control list is a superset of the app-wide CONTROL_MARKETS", () => {
  for (const m of CONTROL_MARKETS) assert.ok(IG_CONTROL_CITIES.includes(m), `${m} must stay excluded in the IG wave`);
});

// ── (e) asset page: noindex, and never in a sitemap ──

test("asset pack page metadata is noindex,nofollow", async () => {
  const { generateMetadata } = await import("../src/app/[locale]/for-hotels/assets/[slug]/page");
  const md = await generateMetadata({ params: Promise.resolve({ locale: "en", slug: "hotel-alma" }) });
  const robots = md.robots as { index?: boolean; follow?: boolean };
  assert.equal(robots.index, false);
  assert.equal(robots.follow, false);
});

// ── (f) G14 guard: the email lane's pitch text is byte-identical (exact snapshot) ──

test("buildVariantPitch v2 output is unchanged (guards accidental edits to the email lane)", () => {
  const out = buildVariantPitch(
    "v2",
    { name: "Hotel Alma", score: 8.6, slug: "hotel-alma", city: "Bruges", description: "A snug canal-side townhouse. Guests praise the fireplace lounge." },
    { base: "https://gotcosy.com" },
  );
  assert.equal(out.subject, "Your guests made Hotel Alma one of the cosiest hotels in Bruges");
  assert.equal(
    out.body,
    `Hi,

I run GotCosy, a small hotel-discovery site. We analyse the guest reviews of 17,727 hotels for warmth and character, and Hotel Alma came out in the top 2.3% of them, with a cosy score of 8.6/10.

What earned it is what your own guests keep saying; this line is condensed from their reviews: "A snug canal-side townhouse. Guests praise the fireplace lounge."

Your page, with the score and the reasons behind it: https://gotcosy.com/en/hotels/hotel-alma

We mainly wanted whoever creates that warmth to know how clearly it shows. If you'd like a small "Rated Cosy" badge for your website, it's free: https://gotcosy.com/en/hotels/hotel-alma?badge

If you'd rather not hear from us, just reply "no thanks".

Per
gotcosy.com`,
  );
});

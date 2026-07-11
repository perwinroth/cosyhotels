// Rising-intent facets (die-validation trend report 2026-07-12): regex over-match guards, the
// facet/concept contract, and the quietcation/sleep-tourism synonym copy. Node built-in runner:
// npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { FACETS, facetBySlug, matchesFacet } from "../src/lib/facets";
import { CONCEPT_BY_SLUG, LEGACY_FACET_SLUGS, REGEX_FACET_SLUGS, cityCollectionMin, conceptCityBlocked } from "../src/lib/travellerFit";

// ── the five original facets are untouched (G14: never break existing integrations) ──

test("the legacy five facets keep their slugs, order and regexes", () => {
  assert.deepEqual(
    FACETS.slice(0, 5).map((f) => f.slug),
    ["fireplace", "romantic", "spa", "boutique", "views"],
  );
  assert.equal(FACETS[0].re.source, "fireplace|hearth|log fire|wood[- ]?burn|open fire");
  assert.equal(FACETS[1].re.source, "romanti|honeymoon|couples?\\b|candle|four[- ]?poster");
  assert.equal(FACETS[2].re.source, "\\bspa\\b|onsen|sauna|hot[- ]?spring|thermal|hammam|soaking tub|hot tub|wellness");
  assert.equal(FACETS[3].re.source, "boutique|independent|design[- ]?led|design hotel|family[- ]?run|owner[- ]?run");
  assert.equal(FACETS[4].re.source, "\\bview|panoram|overlook|rooftop|sea view|mountain|skyline");
});

// ── the facet ↔ concept contract every surface relies on ──

test("every facet slug has a collection-enabled concept and, for regex facets, an IDENTICAL regex", () => {
  for (const f of FACETS) {
    const c = CONCEPT_BY_SLUG[f.slug];
    assert.ok(c, `facet ${f.slug} needs a travellerFit concept (link gates call cityCollectionMin on it)`);
    assert.equal(c.collectionEnabled, true, `${f.slug} concept must be collection-enabled`);
    if (REGEX_FACET_SLUGS.has(f.slug)) {
      assert.equal(c.re.source, f.re.source, `${f.slug}: concept regex must equal the facets.ts regex`);
      assert.equal(c.re.flags, f.re.flags, `${f.slug}: concept regex flags must match`);
    }
  }
});

test("REGEX_FACET_SLUGS = the legacy five plus quiet; rising facets keep the >=5 city gate", () => {
  for (const slug of LEGACY_FACET_SLUGS) assert.ok(REGEX_FACET_SLUGS.has(slug));
  assert.ok(REGEX_FACET_SLUGS.has("quiet"));
  assert.equal(cityCollectionMin(CONCEPT_BY_SLUG["quiet"]), 5, "quiet must NOT inherit the legacy 2 gate");
});

// ── quiet: over-match guards (HAZARD: bare "sleep" and embedded "calm" must never match) ──

const quiet = facetBySlug("quiet")!;

test("quiet facet exists with the sleep-intent label", () => {
  assert.ok(quiet);
  assert.equal(quiet.label, "for a quiet night's sleep");
  assert.equal(quiet.noun, "a quiet night's sleep");
});

test("bare 'sleep' does NOT match quiet (every hotel description mentions sleeping)", () => {
  assert.equal(matchesFacet(quiet, null, "people still sleep in them"), false);
  assert.equal(matchesFacet(quiet, ["comfortable beds to sleep in"], "guests sleep well here"), false);
  assert.equal(matchesFacet(quiet, null, "a good night's sleep guaranteed by blackout blinds"), false);
});

test("'calm' only matches as a whole word (no becalmed/recalmed)", () => {
  assert.equal(matchesFacet(quiet, null, "the becalmed harbour"), false);
  assert.equal(matchesFacet(quiet, null, "recalmed after renovation"), false);
  assert.equal(matchesFacet(quiet, null, "a calm courtyard"), true);
  assert.equal(matchesFacet(quiet, null, "calming views over the loch"), true);
});

test("quiet positives: real signal language matches", () => {
  assert.equal(matchesFacet(quiet, ["peaceful courtyard"], null), true);
  assert.equal(matchesFacet(quiet, null, "wonderfully quiet rooms on a side street"), true);
  assert.equal(matchesFacet(quiet, ["tranquil garden setting"], ""), true);
  assert.equal(matchesFacet(quiet, null, "hushed lounges and serene corridors"), true);
  assert.equal(matchesFacet(quiet, null, "silence and tranquility"), true);
  assert.equal(matchesFacet(quiet, null, "tucked away from the crowds, off the beaten track"), true);
});

test("quiet regex is a strict superset of the old concept regex's word list (no member ever lost)", () => {
  for (const s of ["quiet", "peaceful", "tranquil", "serene", "secluded", "restful", "hushed"]) {
    assert.equal(quiet.re.test(`a ${s} stay`), true, s);
  }
  assert.equal(quiet.re.test("away from the hustle"), true);
  assert.equal(quiet.re.test("off the beaten path"), true);
});

// ── the quietcation / sleep tourism synonym copy (demand-vocabulary rule, founder 2026-07-12) ──

test("quiet hub intro carries 'quietcation' and 'sleep tourism' exactly once each, in house style", () => {
  const intro = quiet.intro || "";
  assert.equal((intro.match(/quietcation/gi) || []).length, 1, "quietcation exactly once");
  assert.equal((intro.match(/sleep tourism/gi) || []).length, 1, "sleep tourism exactly once");
  assert.ok(!intro.includes("—"), "no em dashes (founder rule 2026-07-08)");
  assert.ok((intro.match(/honest/gi) || []).length <= 1, "'honest' at most once");
  assert.ok(!/nestled|hidden gem|whether you're/i.test(intro), "no banned cliches");
});

test("only quiet defines an intro override; the legacy five render their unchanged data-led intro", () => {
  for (const f of FACETS.slice(0, 5)) assert.equal(f.intro, undefined, f.slug);
  assert.ok(quiet.intro && quiet.intro.length > 0);
});

// ── experiment-control exclusion: NEW facets never mint control-market pages (coordinator rule) ──

test("control-market city pages are excluded for the NEW quiet facet; New York survives", () => {
  const c = CONCEPT_BY_SLUG["quiet"];
  for (const city of ["York", "Fez", "Venice", "Savannah", "venice", " york ", "Venice-historic"]) {
    assert.equal(conceptCityBlocked(c, city), true, `${city} must be blocked for quiet`);
  }
  assert.equal(conceptCityBlocked(c, "New York"), false, "New York must survive");
  assert.equal(conceptCityBlocked(c, "Yorkshire"), false, "exact match only, never substring");
  assert.equal(conceptCityBlocked(c, "Fes al Bali"), false, "exact match only");
});

test("legacy facets' control-market behaviour is byte-identical: never blocked", () => {
  for (const slug of LEGACY_FACET_SLUGS) {
    const c = CONCEPT_BY_SLUG[slug];
    for (const city of ["York", "Fez", "Venice", "Savannah", "New York"]) {
      assert.equal(conceptCityBlocked(c, city), false, `${slug}/${city} must stay exactly as before`);
    }
  }
});

test("the exclusion is structural: every enumeration surface consults conceptCityBlocked", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  for (const f of [
    "src/app/[locale]/cosy-hotels/[facet]/[city]/page.tsx", // city-page generation/rendering
    "src/app/[locale]/cosy-hotels/[facet]/page.tsx",        // global hub's city list
    "src/lib/seo/sitemapData.ts",                            // sitemap emission
    "src/lib/seo/cityHotels.ts",                             // conceptCityMembersLive (link verification)
    "src/app/[locale]/hotels/[slug]/page.tsx",               // hotel-page facet + badge links
    "src/app/[locale]/guides/[slug]/page.tsx",               // guide-page facet links
  ]) {
    const src = readFileSync(join(__dirname, "..", f), "utf8");
    assert.ok(src.includes("conceptCityBlocked"), `${f} must consult conceptCityBlocked`);
  }
});

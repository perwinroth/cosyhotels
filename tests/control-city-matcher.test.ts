// Form-robust control-city matcher (founder-ordered fix, 2026-07-21): "fix the control cites and
// make sure tehy stay control." memory/findings/incident-control-city-form-leak-2026-07-21 found
// the OLD exact-match lists (isIgControlCity/IG_CONTROL_CITIES, FACET_MINT_CONTROL_CITIES) matched
// only the canonical spelling and silently under-excluded every other live DB form of the same
// place — Venice-historic's exclusion excluded ZERO rows for months. isOutreachControlCity
// (src/lib/controlMarkets.ts) fixes that at the shared source, per
// memory/findings/spec-control-city-matcher-2026-07-21. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isOutreachControlCity } from "../src/lib/controlMarkets";
import { isOutreachControlCity as isOutreachControlCityViaSeeder, findUncoveredControlForms, assertControlCensusCovered } from "../scripts/seed-ig-outreach.mjs";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// ── (a) every live DB city form named in the incident finding => true ──────────────────────────

const CENSUS_TRUE_FORMS = [
  // Savannah — GSC control
  "Savannah",
  // York — GSC control, plain + postcode-suffixed forms
  "York", "York YO1 8BB", "York YO24 1AA", "York YO62 5BJ",
  // Fez — Marrakech 001 analysis control, canonical + every non-matching census form
  "Fez", "fez",
  "Fès", "Fes Médina", "FES medina", "Fes Medina", "Fes El Bali - Medina",
  "15 SALAGE FES MEDINA", "Fes Médina ain zleten", "Fes Médina derb el miter",
  "Derb Taryana Kebira, Fès Medina", "FeZ MEDINA DERB SIDI YAALA",
  // Venice — Bruges-pilot analysis control; the exclusion excluded ZERO rows before this fix
  "Venice", "Metropolitan City of Venice", "Venice-historic", "Venice historic", "Venezia",
];

test("isOutreachControlCity matches every control-family form named in the incident finding", () => {
  for (const form of CENSUS_TRUE_FORMS) {
    assert.equal(isOutreachControlCity(form), true, `${JSON.stringify(form)} must be excluded (control-market form)`);
  }
});

// ── (b) the forms that must NEVER match, however close they look ───────────────────────────────

const NEVER_MATCH_FORMS = ["New York", "North York", "Yorkshire", "Blaenau Ffestiniog"];

test("isOutreachControlCity never matches New York / North York / Yorkshire / Blaenau Ffestiniog", () => {
  for (const form of NEVER_MATCH_FORMS) {
    assert.equal(isOutreachControlCity(form), false, `${JSON.stringify(form)} must NOT be excluded (non-control place name)`);
  }
});

test("isOutreachControlCity is false/safe on empty input", () => {
  assert.equal(isOutreachControlCity(null), false);
  assert.equal(isOutreachControlCity(undefined), false);
  assert.equal(isOutreachControlCity(""), false);
  assert.equal(isOutreachControlCity("Bruges"), false);
});

// ── (c) parity: the seeder re-exports the SAME function, not a mirror/reimplementation ──────────

test("scripts/seed-ig-outreach.mjs re-exports the identical src/lib/controlMarkets.ts function (no mirror hedge)", () => {
  assert.equal(isOutreachControlCityViaSeeder, isOutreachControlCity, "the seeder must import isOutreachControlCity directly from src/lib, not duplicate it");
});

// ── (d) runtime census guard: catches an unmatched control-token form before any insert ─────────

test("findUncoveredControlForms is clean against every true-case and never-match form above", () => {
  const offending = findUncoveredControlForms([...CENSUS_TRUE_FORMS, ...NEVER_MATCH_FORMS, "Bruges", null, ""]);
  assert.deepEqual(offending, [], `the census guard must find nothing wrong with already-covered/known-safe forms: ${JSON.stringify(offending)}`);
});

test("findUncoveredControlForms flags a NEW, unmatched control-token city form", () => {
  const offending = findUncoveredControlForms(["Fake Yorkland"]);
  assert.deepEqual(offending, ["Fake Yorkland"], "a control-token substring that isOutreachControlCity doesn't match and isn't an allowed non-control form must be flagged");
});

test("assertControlCensusCovered is a no-op on a clean census", () => {
  assert.doesNotThrow(() => assertControlCensusCovered(["Bruges", "New York", "York", "Savannah"]));
});

// ── (e) structural gate: every actionable outreach surface uses the shared matcher ──────────────
// (same style as tests/gate-third-party-cta.test.ts — grep-based against source, so a future
// surface can't silently skip the control-city filter.)

const ACTIONABLE_OUTREACH_SURFACES = [
  "src/app/growth/badges/page.tsx",
  "src/app/growth/lib.tsx",
  "src/app/outreach/page.tsx",
  "src/app/follow/page.tsx",
];

test("every actionable outreach surface imports and calls isOutreachControlCity", () => {
  for (const f of ACTIONABLE_OUTREACH_SURFACES) {
    const src = read(f);
    assert.match(src, /\bimport \{[^}]*\bisOutreachControlCity\b[^}]*\} from ["']@\/lib\/controlMarkets["']/, `${f} must import isOutreachControlCity from @/lib/controlMarkets`);
    assert.match(src, /\bisOutreachControlCity\(/, `${f} must actually call isOutreachControlCity`);
  }
});

test("both outreach seeders' exclusion call sites use isOutreachControlCity, not the deprecated exact-match isIgControlCity", () => {
  for (const f of ["scripts/seed-ig-outreach.mjs", "scripts/seed-email-outreach.mjs"]) {
    const src = read(f);
    assert.match(src, /isOutreachControlCity\(h\.city\)/, `${f}'s exclusion call site must filter with isOutreachControlCity`);
    assert.doesNotMatch(src, /isIgControlCity\(h\.city\)/, `${f} must no longer exclude via the deprecated exact-match isIgControlCity`);
  }
});

test("both outreach seeders run the runtime census guard on the full candidate pool before any insert", () => {
  for (const f of ["scripts/seed-ig-outreach.mjs", "scripts/seed-email-outreach.mjs"]) {
    const src = read(f);
    assert.match(src, /assertControlCensusCovered\(/, `${f} must call the runtime census guard`);
  }
});

// ── (f) old exports untouched — tests/ig-wave.test.ts locks their semantics, this just re-affirms
// the deprecation is additive, never a behavior change ─────────────────────────────────────────

test("the deprecated isIgControlCity/IG_CONTROL_CITIES are untouched (still exported, still exact-match)", () => {
  const src = read("scripts/seed-ig-outreach.mjs");
  assert.match(src, /export const IG_CONTROL_CITIES = \["savannah", "york", "fez", "venice-historic"\];/, "IG_CONTROL_CITIES literal must stay unchanged");
  assert.match(src, /export function isIgControlCity\(city\) \{/, "isIgControlCity must stay exported");
});

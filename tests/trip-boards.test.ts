// Trip-planner v0 (launch-4 boards). Contracts under test:
//   • live-score gate: below-5.0 picks drop; a stop with < 2 live picks noindexes the board
//   • control exclusion: EXACT match only (york != New York), whole board excluded
//   • cityAlias resolution: the alias spellings are part of the stop's lookup set
//   • translatability: the board page wraps every editorial string in translate() for non-en
//   • house style on the DRAFT copy: em-dash ban, honest-cap
// Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { TRIP_BOARDS, getTripBoard } from "../src/data/tripBoards";
import {
  PUBLIC_GATE, MIN_PICKS_PER_STOP, MAX_PICKS_PER_STOP,
  stopCities, stopTouchesControl, boardTouchesControl,
  gateAndRankPicks, boardIsIndexable, type StopPick,
} from "../src/lib/trips";

const pick = (slug: string, score: number): StopPick => ({ slug, name: slug, city: "X", country: "Y", score });

// ── the launch set is boards 1, 2, 3, 12 (Flanders, Tuscany, Alpine, Copenhagen), PLUS the
//    cozy-US experiment arm (cozy-new-england-autumn), the one board that spells the head term
//    "cozy" by design to read the larger US market against the cosy boards ──

test("launch-4 boards plus the cozy-US experiment arm present, no control-market or Venice board", () => {
  assert.equal(TRIP_BOARDS.length, 5);
  const slugs = TRIP_BOARDS.map((b) => b.slug).sort();
  assert.deepEqual(slugs, [
    "alpine-winter-without-the-crowds",
    "copenhagen-in-the-cosy-months",
    "cosy-flanders-december",
    "cozy-new-england-autumn",
    "tuscany-hill-towns",
  ]);
  for (const b of TRIP_BOARDS) {
    assert.equal(boardTouchesControl(b), false, `${b.slug} must not touch a control market`);
    for (const s of b.stops) {
      for (const c of stopCities(s)) {
        assert.ok(!/venice|venezia/i.test(c), `${b.slug}: no Venice stop (${c})`);
      }
    }
  }
});

// ── live-score contract: gate + rank + noindex rule ──

test("gateAndRankPicks drops below-gate picks, sorts desc, dedups, caps at MAX", () => {
  const ranked = gateAndRankPicks([
    pick("a", 4.9),         // below the 5.0 gate -> dropped
    pick("b", 7.2),
    pick("c", 6.1),
    pick("b", 7.2),         // duplicate slug -> collapsed
    pick("d", 5.0),         // exactly the gate -> kept
    pick("e", 8.4),
  ]);
  assert.equal(PUBLIC_GATE, 5.0);
  assert.deepEqual(ranked.map((p) => p.slug), ["e", "b", "c"]); // top 3 by score, no 'a', no dup
  assert.equal(ranked.length, MAX_PICKS_PER_STOP);
  assert.ok(ranked.every((p) => p.score >= PUBLIC_GATE));
});

test("a 4.9 pick can never surface (public gate is 5.0, not <5)", () => {
  assert.deepEqual(gateAndRankPicks([pick("x", 4.9), pick("y", 4.99)]), []);
});

test("a board with any stop under 2 live picks noindexes itself", () => {
  const board = getTripBoard("cosy-flanders-december")!;
  // Bruges resolves 3, Ghent resolves only 1 -> board is NOT indexable.
  assert.equal(
    boardIsIndexable(board, [[pick("a", 7), pick("b", 6), pick("c", 5.5)], [pick("d", 6)]]),
    false,
  );
  // Both stops resolve >= 2 -> indexable.
  assert.equal(
    boardIsIndexable(board, [[pick("a", 7), pick("b", 6)], [pick("d", 6), pick("e", 5.2)]]),
    true,
  );
  assert.equal(MIN_PICKS_PER_STOP, 2);
});

test("a board whose stop count and picks arrays disagree is not indexable (defensive)", () => {
  const board = getTripBoard("tuscany-hill-towns")!; // 3 stops
  assert.equal(boardIsIndexable(board, [[pick("a", 7), pick("b", 6)]]), false);
});

// ── control exclusion: EXACT match, never substring ──

test("stopTouchesControl is exact-match: york is blocked, New York and Yorkshire are not", () => {
  assert.equal(stopTouchesControl({ city: "York", nights: 1, cityAliases: [], whyOrder: "" }), true);
  assert.equal(stopTouchesControl({ city: "Savannah", nights: 1, cityAliases: [], whyOrder: "" }), true);
  assert.equal(stopTouchesControl({ city: "Fez", nights: 1, cityAliases: [], whyOrder: "" }), true);
  assert.equal(stopTouchesControl({ city: "Venice", nights: 1, cityAliases: [], whyOrder: "" }), true);
  assert.equal(stopTouchesControl({ city: "New York", nights: 1, cityAliases: [], whyOrder: "" }), false);
  assert.equal(stopTouchesControl({ city: "Yorkshire", nights: 1, cityAliases: [], whyOrder: "" }), false);
});

test("a control market hiding in cityAliases is still caught", () => {
  assert.equal(
    stopTouchesControl({ city: "Someplace", nights: 1, cityAliases: ["York"], whyOrder: "" }),
    true,
  );
});

test("a board with a control stop is never indexable, regardless of picks", () => {
  const controlBoard = {
    slug: "x", title: "t", dek: "d", season: "s", whenToGo: "w", aiPromptPatterns: [], publishedAt: "2026-07-14",
    stops: [{ city: "York", nights: 1, cityAliases: [], whyOrder: "" }],
  };
  assert.equal(boardTouchesControl(controlBoard), true);
  assert.equal(boardIsIndexable(controlBoard, [[pick("a", 8), pick("b", 7)]]), false);
});

// ── cityAlias resolution ──

test("Bruges stop carries the Brugge alias; Copenhagen carries København; Füssen carries Fussen", () => {
  const bruges = getTripBoard("cosy-flanders-december")!.stops[0];
  assert.ok(stopCities(bruges).includes("Bruges"));
  assert.ok(stopCities(bruges).includes("Brugge"), "Bruges/Brugge alias must be present");

  const cph = getTripBoard("copenhagen-in-the-cosy-months")!.stops[0];
  assert.ok(stopCities(cph).some((c) => /K.benhavn/i.test(c)), "København alias must be present");

  const fussen = getTripBoard("alpine-winter-without-the-crowds")!.stops[2];
  assert.ok(stopCities(fussen).includes("Fussen"), "Füssen/Fussen alias must be present");
});

// ── translatability: the board page wraps EVERY editorial string in translate() for non-en ──

test("the trips page routes editorial strings through translate() for non-en", () => {
  const src = readFileSync(join(__dirname, "..", "src/app/[locale]/trips/[slug]/page.tsx"), "utf8");
  // Mirrors the guide page's contract: translate() is imported and called, gated on locale !== 'en'.
  assert.ok(src.includes('from "@/lib/i18n/translate"'), "must import translate");
  assert.ok(/translate\(/.test(src), "must call translate()");
  assert.ok(/locale\s*===\s*"en"\s*\?/.test(src), "must gate translation on locale === 'en'");
  // Every editorial field is wrapped via the t() helper.
  for (const field of ["board.title", "board.dek", "board.whenToGo", "board.season"]) {
    assert.ok(src.includes(`t(${field})`), `${field} must be wrapped for translation`);
  }
  assert.ok(/t\(s\.stop\.whyOrder\)/.test(src), "whyOrder must be wrapped for translation");
  // generateMetadata translates title + dek too.
  assert.ok(/await t\(board\.title\)/.test(src) && /await t\(board\.dek\)/.test(src), "metadata must translate");
});

test("the /plan page routes its editorial copy through translate() for non-en", () => {
  const src = readFileSync(join(__dirname, "..", "src/app/[locale]/plan/page.tsx"), "utf8");
  assert.ok(src.includes('from "@/lib/i18n/translate"'), "must import translate");
  assert.ok(/locale\s*===\s*"en"\s*\?/.test(src), "must gate translation on locale === 'en'");
  assert.ok(/t\(b\.title\)/.test(src) && /t\(b\.dek\)/.test(src), "board title + dek translated on /plan");
});

// ── house style holds even on the DRAFT copy (em-dash ban, honest-cap) ──

test("no board editorial string contains an em dash", () => {
  for (const b of TRIP_BOARDS) {
    const strings = [b.title, b.dek, b.season, b.whenToGo, ...b.aiPromptPatterns, ...b.stops.map((s) => s.whyOrder)];
    for (const s of strings) assert.ok(!s.includes("—"), `em dash in ${b.slug}: "${s}"`);
  }
});

test("each board uses 'honest' at most once across its copy", () => {
  for (const b of TRIP_BOARDS) {
    const all = [b.title, b.dek, b.whenToGo, ...b.stops.map((s) => s.whyOrder)].join(" ");
    assert.ok((all.match(/honest/gi) || []).length <= 1, `${b.slug} exceeds the honest cap`);
  }
});

test("every board carries stops, a season, whenToGo and aiPromptPatterns (data-shape guard)", () => {
  for (const b of TRIP_BOARDS) {
    assert.ok(b.stops.length >= 1 && b.stops.length <= 4, `${b.slug} stop count`);
    assert.ok(b.season && b.whenToGo, `${b.slug} season/whenToGo`);
    assert.ok(b.aiPromptPatterns.length >= 1, `${b.slug} aiPromptPatterns`);
    for (const s of b.stops) {
      assert.ok(s.city && s.whyOrder && s.nights > 0, `${b.slug} stop shape`);
    }
  }
});

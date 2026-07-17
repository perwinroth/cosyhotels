// D-0010 "Feelings Layer" probe: unit tests for the pure graph-shaping functions in
// src/lib/graph/hotels.ts. These are the functions the /api/graph/* route handlers and the MCP
// tools (find_cosy_hotels, get_hotel_feeling) both delegate to, so testing their SHAPE here covers
// the endpoint contract without needing a live Supabase connection (same split as
// src/lib/seo/cityHotels.ts's pure cityMembers()/orderConceptMembers() vs its DB-touching
// loadCityCosyHotels()). Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapGraphHotelRow,
  buildGraphHotelsResult,
  buildGraphHotelDetail,
  PUBLIC_GATE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  BELOW_BAR_NOTE,
  type GraphRawRow,
} from "../src/lib/graph/hotels";

const STAY22_WRONG_HOTEL = "misdirected-hotel";
const REAL_WEBSITE = "https://www.example-hotel.com/";
const OTA_WEBSITE = "https://www.booking.com/hotel/xx/example.html";

function row(overrides: Partial<GraphRawRow> & { hotel?: Partial<NonNullable<GraphRawRow["hotel"]>> } = {}): GraphRawRow {
  return {
    score: 6.5,
    score_final: null,
    ...overrides,
    hotel: {
      slug: "example-hotel",
      name: "Example Hotel",
      name_en: null,
      city: "Paris",
      country: "France",
      website: null,
      ...(overrides.hotel || {}),
    },
  };
}

// ── mapGraphHotelRow ─────────────────────────────────────────────────────────────────────────

test("mapGraphHotelRow returns a summary with cosy_score = score_final ?? score, 1dp", () => {
  const r = row({ score: 6.44, score_final: 7.256 });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out?.cosy_score, 7.3);
});

test("mapGraphHotelRow falls back to score when score_final is null", () => {
  const r = row({ score: 6.44, score_final: null });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out?.cosy_score, 6.4);
});

test("mapGraphHotelRow excludes a delisted hotel entirely", () => {
  const r = row({ hotel: { slug: "brae-lodge" } });
  const out = mapGraphHotelRow(r, { delisted: new Set(["brae-lodge"]), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out, null);
});

test("mapGraphHotelRow excludes a hotel below the requested min score", () => {
  const r = row({ score: 5.5, score_final: null });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: 6 });
  assert.equal(out, null);
});

test("mapGraphHotelRow excludes rows with no slug or no name", () => {
  assert.equal(mapGraphHotelRow(row({ hotel: { slug: null as unknown as string } }), { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE }), null);
  assert.equal(mapGraphHotelRow(row({ hotel: { name: null, name_en: null } }), { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE }), null);
});

test("mapGraphHotelRow prefers name_en over name", () => {
  const r = row({ hotel: { name: "日本語名", name_en: "Japanese Name Hotel" } });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out?.name, "Japanese Name Hotel");
});

test("mapGraphHotelRow: verified_booking defaults to stay22 even with a real website (unverified default)", () => {
  const r = row({ hotel: { website: REAL_WEBSITE } });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out?.verified_booking, "stay22");
  assert.equal(out?.website, REAL_WEBSITE); // website still shown — isRealHotelWebsite is independent of CTA posture
});

test("mapGraphHotelRow: verified_booking is own_website only when verified-wrong AND a real website exists", () => {
  const r = row({ hotel: { slug: STAY22_WRONG_HOTEL, website: REAL_WEBSITE } });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set([STAY22_WRONG_HOTEL]), minScore: PUBLIC_GATE });
  assert.equal(out?.verified_booking, "own_website");
});

test("mapGraphHotelRow: verified-wrong with no real website stays stay22 (relabelled 'nearby' internally, but posture is still stay22)", () => {
  const r = row({ hotel: { slug: STAY22_WRONG_HOTEL, website: null } });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set([STAY22_WRONG_HOTEL]), minScore: PUBLIC_GATE });
  assert.equal(out?.verified_booking, "stay22");
  assert.equal(out?.website, undefined);
});

test("mapGraphHotelRow never exposes an OTA/aggregator domain as website", () => {
  const r = row({ hotel: { website: OTA_WEBSITE } });
  const out = mapGraphHotelRow(r, { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.equal(out?.website, undefined);
});

test("mapGraphHotelRow builds the page URL as /en/hotels/{slug}", () => {
  const out = mapGraphHotelRow(row({ hotel: { slug: "some-slug" } }), { delisted: new Set(), wrongSlugs: new Set(), minScore: PUBLIC_GATE });
  assert.ok(out?.url.endsWith("/en/hotels/some-slug"));
});

// ── buildGraphHotelsResult ───────────────────────────────────────────────────────────────────

test("buildGraphHotelsResult filters, sorts by cosy_score desc, and paginates", () => {
  const rows = [
    row({ score: 6.0, hotel: { slug: "a", name: "A" } }),
    row({ score: 8.0, hotel: { slug: "b", name: "B" } }),
    row({ score: 7.0, hotel: { slug: "c", name: "C" } }),
  ];
  const out = buildGraphHotelsResult(rows, new Set(), new Set(), {});
  assert.deepEqual(out.hotels.map((h) => h.slug), ["b", "c", "a"]);
  assert.equal(out.total, 3);
  assert.equal(out.limit, DEFAULT_LIMIT);
  assert.equal(out.offset, 0);
});

test("buildGraphHotelsResult applies limit/offset over the FILTERED+SORTED set, total is pre-slice", () => {
  const rows = Array.from({ length: 5 }, (_, i) => row({ score: 5 + i, hotel: { slug: `h${i}`, name: `H${i}` } }));
  const out = buildGraphHotelsResult(rows, new Set(), new Set(), { limit: 2, offset: 1 });
  assert.equal(out.total, 5);
  assert.equal(out.hotels.length, 2);
  // sorted desc by score: h4(9),h3(8),h2(7),h1(6),h0(5) — offset 1, limit 2 => h3,h2
  assert.deepEqual(out.hotels.map((h) => h.slug), ["h3", "h2"]);
});

test("buildGraphHotelsResult clamps limit to MAX_LIMIT and rejects a non-positive limit", () => {
  const rows = [row()];
  const tooBig = buildGraphHotelsResult(rows, new Set(), new Set(), { limit: 500 });
  assert.equal(tooBig.limit, MAX_LIMIT);
  const zero = buildGraphHotelsResult(rows, new Set(), new Set(), { limit: 0 });
  assert.equal(zero.limit, DEFAULT_LIMIT);
});

test("buildGraphHotelsResult never lets min_score undercut the PUBLIC_GATE floor", () => {
  const rows = [row({ score: 4.9, hotel: { slug: "low", name: "Low" } })];
  const out = buildGraphHotelsResult(rows, new Set(), new Set(), { minScore: 0 });
  assert.equal(out.total, 0); // 4.9 < PUBLIC_GATE(5) regardless of the requested min_score=0
});

test("buildGraphHotelsResult excludes delisted hotels from the list", () => {
  const rows = [row({ hotel: { slug: "brae-lodge", name: "Brae Lodge" } }), row({ hotel: { slug: "keep-me", name: "Keep Me" } })];
  const out = buildGraphHotelsResult(rows, new Set(["brae-lodge"]), new Set(), {});
  assert.deepEqual(out.hotels.map((h) => h.slug), ["keep-me"]);
});

test("buildGraphHotelsResult filters by city (accent/case-insensitive substring)", () => {
  const rows = [
    row({ hotel: { slug: "paris-1", name: "Paris Hotel", city: "Paris" } }),
    row({ hotel: { slug: "malaga-1", name: "Malaga Hotel", city: "Málaga" } }),
  ];
  const out = buildGraphHotelsResult(rows, new Set(), new Set(), { city: "malaga" });
  assert.deepEqual(out.hotels.map((h) => h.slug), ["malaga-1"]);
});

test("buildGraphHotelsResult filters by country", () => {
  const rows = [
    row({ hotel: { slug: "fr-1", name: "France Hotel", country: "France" } }),
    row({ hotel: { slug: "jp-1", name: "Japan Hotel", country: "Japan" } }),
  ];
  const out = buildGraphHotelsResult(rows, new Set(), new Set(), { country: "japan" });
  assert.deepEqual(out.hotels.map((h) => h.slug), ["jp-1"]);
});

// ── buildGraphHotelDetail ────────────────────────────────────────────────────────────────────

const HOTEL = { slug: "example-hotel", name: "Example Hotel", name_en: null, city: "Paris", country: "France", website: null };

test("buildGraphHotelDetail returns full detail with signals/description for a live, above-gate hotel", () => {
  const out = buildGraphHotelDetail(HOTEL, { score: 7.2, score_final: null, description: "A cosy stay.", signals: ["fireplace", "quiet"] }, new Set());
  assert.ok(!("below_bar" in out));
  if (!("below_bar" in out)) {
    assert.equal(out.cosy_score, 7.2);
    assert.equal(out.description, "A cosy stay.");
    assert.deepEqual(out.signals, ["fireplace", "quiet"]);
    assert.ok(out.url.endsWith("/en/hotels/example-hotel"));
  }
});

test("buildGraphHotelDetail defaults signals to [] when null/missing", () => {
  const out = buildGraphHotelDetail(HOTEL, { score: 6, score_final: null, description: null, signals: null }, new Set());
  assert.ok(!("below_bar" in out));
  if (!("below_bar" in out)) assert.deepEqual(out.signals, []);
});

test("buildGraphHotelDetail returns a below_bar stub with no score for a hotel scoring under 5.0", () => {
  const out = buildGraphHotelDetail(HOTEL, { score: 4.5, score_final: null, description: "Should never appear", signals: ["x"] }, new Set());
  assert.equal((out as { below_bar?: boolean }).below_bar, true);
  assert.equal((out as { note?: string }).note, BELOW_BAR_NOTE);
  assert.equal((out as { cosy_score?: number }).cosy_score, undefined);
  assert.equal((out as { description?: string }).description, undefined);
  assert.equal((out as { signals?: string[] }).signals, undefined);
});

test("buildGraphHotelDetail returns below_bar for an unrated hotel (no cosy_scores row at all)", () => {
  const out = buildGraphHotelDetail(HOTEL, null, new Set());
  assert.equal((out as { below_bar?: boolean }).below_bar, true);
});

test("buildGraphHotelDetail: score_final overrides score when both present", () => {
  const out = buildGraphHotelDetail(HOTEL, { score: 4.0, score_final: 6.5, description: null, signals: null }, new Set());
  assert.ok(!("below_bar" in out)); // score_final 6.5 clears the gate even though raw score doesn't
});

test("buildGraphHotelDetail sets verified_booking own_website only when the slug is in wrongSlugs and has a real website", () => {
  const withRealSite = { ...HOTEL, slug: STAY22_WRONG_HOTEL, website: REAL_WEBSITE };
  const out = buildGraphHotelDetail(withRealSite, { score: 6, score_final: null, description: null, signals: null }, new Set([STAY22_WRONG_HOTEL]));
  assert.ok(!("below_bar" in out));
  if (!("below_bar" in out)) {
    assert.equal(out.verified_booking, "own_website");
    assert.equal(out.website, REAL_WEBSITE);
  }
});

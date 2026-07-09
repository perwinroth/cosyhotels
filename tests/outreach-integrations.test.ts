// Regression suite for the 2026-07-09 fixes (PRs #37–#40) and the G14 failure class:
// integrations must keep declaring the truths the rest of the system depends on.
// Runs with the Node built-in runner, zero new deps:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.NEXT_PUBLIC_SITE_URL = "https://gotcosy.com";

import { rawMessage } from "../src/lib/gmail";
import { INDEXNOW_KEY, submitUrlsToIndexNow, submitUrlsToBing } from "../src/lib/indexing";
import { CONCEPTS, CONCEPT_BY_SLUG, LEGACY_FACET_SLUGS, cityCollectionMin } from "../src/lib/travellerFit";
import { citiesLarge } from "../src/data/cities_large";
import { cities } from "../src/data/cities";
import { isControlMarket, CONTROL_MARKETS } from "../src/lib/controlMarkets";

const decodeRaw = (raw: string) => Buffer.from(raw, "base64url").toString("utf8");

// ── gmail.ts: the sending identity and header integrity (incident 2026-07-09) ──

test("drafts always declare From: per@gotcosy.com — the product's sending identity", () => {
  const msg = decodeRaw(rawMessage({ to: "x@example.com", subject: "Hi", body: "Body" }));
  const headerBlock = msg.split("\r\n\r\n")[0];
  assert.match(headerBlock, /^From: Got Cosy <per@gotcosy\.com>/m);
});

test("a multiline parsed subject cannot break the header block (the 06:30 corrupted-draft bug)", () => {
  const evil = "\r\n\r\nHARO Journalist Profile URL:\r\nSubject: Re: Travel: NYC hotels";
  const msg = decodeRaw(rawMessage({ to: "reply@helpareporter.com", subject: evil, body: "Real body" }));
  const [headerBlock, ...bodyParts] = msg.split("\r\n\r\n");
  const body = bodyParts.join("\r\n\r\n");
  // Every header the builder sets must still BE a header, not body text.
  for (const h of ["From:", "To:", "Subject:", "MIME-Version:", "Content-Type:"]) {
    assert.match(headerBlock, new RegExp(`^${h.replace("-", "\\-")}`, "m"), `${h} must stay in the header block`);
    assert.ok(!body.includes("MIME-Version:"), "MIME headers must not leak into the body");
  }
  // The subject is single-line and non-empty.
  const subjectLine = headerBlock.split("\r\n").find((l) => l.startsWith("Subject: "));
  assert.ok(subjectLine && subjectLine.length > "Subject: ".length, "subject survives sanitization non-empty");
  assert.equal(body.trim(), "Real body");
});

test("a newline in the To value cannot inject headers", () => {
  const msg = decodeRaw(rawMessage({ to: "a@b.com\r\nBcc: evil@x.com", subject: "S", body: "B" }));
  const headerBlock = msg.split("\r\n\r\n")[0];
  // The CR/LF is collapsed, so "Bcc:" may survive as inert text INSIDE the To value —
  // what must never happen is a new header LINE.
  const lines = headerBlock.split("\r\n");
  assert.ok(!lines.some((l) => l.startsWith("Bcc:")), "injected value must not become its own header line");
  assert.equal(lines.filter((l) => l.startsWith("To: ")).length, 1);
});

// ── indexing.ts: IndexNow contract (PR #37) ──

test("the IndexNow key constant matches the public key file byte-for-byte", () => {
  const file = readFileSync(join(__dirname, "..", "public", `${INDEXNOW_KEY}.txt`), "utf8");
  assert.equal(file.trim(), INDEXNOW_KEY);
});

test("IndexNow submits host, keyLocation and the URL list in one POST", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return new Response("", { status: 200 });
  }) as typeof fetch;
  try {
    const res = await submitUrlsToIndexNow(["https://gotcosy.com/en", "https://gotcosy.com/en/blog"]);
    assert.equal(res.submitted, 2);
    assert.equal(res.errors.length, 0);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.indexnow.org/indexnow");
    assert.equal(calls[0].body.host, "gotcosy.com");
    assert.equal(calls[0].body.key, INDEXNOW_KEY);
    assert.equal(calls[0].body.keyLocation, `https://gotcosy.com/${INDEXNOW_KEY}.txt`);
    assert.deepEqual(calls[0].body.urlList, ["https://gotcosy.com/en", "https://gotcosy.com/en/blog"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("IndexNow with an empty list makes no network call", async () => {
  const realFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response("", { status: 200 }); }) as typeof fetch;
  try {
    const res = await submitUrlsToIndexNow([]);
    assert.equal(res.submitted, 0);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("Bing failures now surface the response body, not a bare status (weeks of silent http_400)", async () => {
  process.env.BING_API_KEY = "test-key";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("ERROR!!! The siteUrl is not registered to this API key.", { status: 400 })) as typeof fetch;
  try {
    const res = await submitUrlsToBing(["https://gotcosy.com/en"]);
    assert.equal(res.submitted, 0);
    assert.match(res.errors[0], /^http_400:.*not registered/);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.BING_API_KEY;
  }
});

// ── travellerFit.ts: collection flags and gates (PR #39, Challenger verdicts) ──

test("rustic collections are enabled; refuted concepts stay disabled", () => {
  assert.equal(CONCEPT_BY_SLUG["rustic"].collectionEnabled, true, "rustic shipped (demand-verified)");
  assert.equal(CONCEPT_BY_SLUG["hidden-gem"].collectionEnabled, false, "hidden-gem was REFUTED (fez control + york bug)");
  assert.equal(CONCEPT_BY_SLUG["luxury-feel"].collectionEnabled, false);
});

test("city minimums: legacy facets 2, newer concepts 5", () => {
  assert.equal(cityCollectionMin(CONCEPT_BY_SLUG["fireplace"]), 2);
  assert.equal(cityCollectionMin(CONCEPT_BY_SLUG["rustic"]), 5);
  for (const slug of LEGACY_FACET_SLUGS) assert.equal(cityCollectionMin(CONCEPT_BY_SLUG[slug]), 2);
});

test("every concept slug is unique and URL-safe", () => {
  const slugs = CONCEPTS.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9-]+$/);
});

// ── cities data: the PR #38 additions and their exclusions ──

test("the 14 audited cities are on the known list exactly once", () => {
  const all = [...cities, ...citiesLarge];
  for (const c of ["Asheville", "Banff", "Stowe", "Sedona", "Skaneateles", "Bath", "Tofino", "Sausalito",
                   "Middleburg", "San Gimignano", "Como", "Montepulciano", "Ronda", "Füssen"]) {
    assert.equal(all.filter((x) => x === c).length, 1, `${c} present exactly once`);
  }
});

test("homonym-merging cities and control markets stay OFF the known list", () => {
  const all = new Set([...cities, ...citiesLarge]);
  for (const banned of ["Lexington", "Woodstock", "Keswick", "Savannah"]) {
    assert.ok(!all.has(banned), `${banned} must not be a known city (homonym merge or control market)`);
  }
});

// ── controlMarkets.ts: the guard the SEO surfaces will need (york bug, G14) ──

test("control detection flags savannah and york but never new york", () => {
  assert.deepEqual([...CONTROL_MARKETS].sort(), ["savannah", "york"]);
  assert.equal(isControlMarket("York"), true);
  assert.equal(isControlMarket("Savannah"), true);
  assert.equal(isControlMarket("New York"), false, "the scrub must keep New York out of the york match");
  assert.equal(isControlMarket("Bruges"), false);
});

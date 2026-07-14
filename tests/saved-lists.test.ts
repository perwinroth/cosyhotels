// Saved lists v1 ("save a place to your plan") — pure contract tests for src/lib/savedLists.ts.
// Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_TITLE_LEN, MAX_ITEMS, sanitizeTitle, isValidEmail, normalizeLocale,
  generateEditToken, tokenAuthorized, withinItemsCap,
} from "../src/lib/savedLists";

test("sanitizeTitle: trims, caps to 80, allows empty/undefined", () => {
  assert.deepEqual(sanitizeTitle(undefined), { ok: true, title: null });
  assert.deepEqual(sanitizeTitle(""), { ok: true, title: null });
  assert.deepEqual(sanitizeTitle("   "), { ok: true, title: null });
  assert.deepEqual(sanitizeTitle("  Our Tuscany trip  "), { ok: true, title: "Our Tuscany trip" });
  const long = "x".repeat(200);
  const capped = sanitizeTitle(long);
  assert.equal(capped.ok, true);
  if (capped.ok) assert.equal(capped.title!.length, MAX_TITLE_LEN);
});

test("sanitizeTitle: rejects any title containing a URL", () => {
  for (const bad of ["Visit http://spam.example", "Visit https://spam.example", "www.spam.example", "check out ftp://x.example", "javascript://alert(1)"]) {
    const r = sanitizeTitle(bad);
    assert.equal(r.ok, false, `expected reject: ${bad}`);
  }
});

test("sanitizeTitle: rejects non-string", () => {
  const r = sanitizeTitle(42);
  assert.equal(r.ok, false);
});

test("isValidEmail: accepts plausible addresses, rejects junk", () => {
  assert.equal(isValidEmail("a@b.com"), true);
  assert.equal(isValidEmail("per@gotcosy.com"), true);
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(isValidEmail("a@b"), false);
  assert.equal(isValidEmail("@b.com"), false);
  assert.equal(isValidEmail("a@.com"), false);
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail(123), false);
});

test("normalizeLocale: passes through enabled locales, defaults others to en", () => {
  assert.equal(normalizeLocale("fr"), "fr");
  assert.equal(normalizeLocale("sv"), "sv");
  assert.equal(normalizeLocale("xx"), "en");
  assert.equal(normalizeLocale(undefined), "en");
  assert.equal(normalizeLocale(123), "en");
});

test("generateEditToken: url-safe, at least 24 chars, not predictable/repeating", () => {
  const a = generateEditToken();
  const b = generateEditToken();
  assert.ok(a.length >= 24, `token too short: ${a.length}`);
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
});

test("tokenAuthorized: legacy rows (no edit_token) stay open; token rows require an exact match", () => {
  const FAKE_TOKEN_FOR_TEST = "not-a-real-token-fixture-xyz";
  assert.equal(tokenAuthorized(null, undefined), true);
  assert.equal(tokenAuthorized(null, "anything"), true);
  assert.equal(tokenAuthorized(FAKE_TOKEN_FOR_TEST, FAKE_TOKEN_FOR_TEST), true);
  assert.equal(tokenAuthorized(FAKE_TOKEN_FOR_TEST, "wrong"), false);
  assert.equal(tokenAuthorized(FAKE_TOKEN_FOR_TEST, undefined), false);
  assert.equal(tokenAuthorized(FAKE_TOKEN_FOR_TEST, ""), false);
});

test("withinItemsCap: enforces the defensive items ceiling", () => {
  assert.equal(withinItemsCap(new Array(MAX_ITEMS).fill("x")), true);
  assert.equal(withinItemsCap(new Array(MAX_ITEMS + 1).fill("x")), false);
});

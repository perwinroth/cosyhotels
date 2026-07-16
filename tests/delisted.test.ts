// Hotel takedown mechanism (trust fix, 2026-07-16): brae-lodge asked for removal because the
// Stay22 booking CTA can misdirect small direct-booking hotels to a different property. Regression
// suite for the two-layer takedown (DELISTED_SLUGS Set + isDelisted's defensive DB check) and the
// website-URL sanitizer that gates the new "Visit hotel website" CTA. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { DELISTED_SLUGS, isDelisted, isValidWebsiteUrl } from "../src/lib/delisted";

test("DELISTED_SLUGS contains brae-lodge", () => {
  assert.ok(DELISTED_SLUGS.has("brae-lodge"));
});

test("isDelisted is true for a Set member with no db client at all (works pre-migration)", async () => {
  assert.equal(await isDelisted("brae-lodge", undefined), true);
  assert.equal(await isDelisted("brae-lodge", null), true);
});

test("isDelisted is false for a non-member slug with no db client", async () => {
  assert.equal(await isDelisted("some-other-hotel", undefined), false);
  assert.equal(await isDelisted("", undefined), false);
});

test("isDelisted defensively falls back to the Set when the db query errors (e.g. missing column)", async () => {
  const erroringDb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: null, error: { message: "column hotels.delisted_at does not exist" } };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof isDelisted>[1];
  assert.equal(await isDelisted("brae-lodge", erroringDb), true); // Set still catches it
  assert.equal(await isDelisted("some-other-hotel", erroringDb), false); // no throw, no false positive
});

test("isDelisted is true when the db row has a non-null delisted_at, even for a non-Set slug", async () => {
  const dbWithDelistedRow = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { delisted_at: "2026-07-16T00:00:00.000Z" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof isDelisted>[1];
  assert.equal(await isDelisted("some-other-hotel", dbWithDelistedRow), true);
});

// ── isValidWebsiteUrl: gates the "Visit hotel website" CTA — only real http(s) URLs render ──

test("isValidWebsiteUrl accepts a real https URL", () => {
  assert.equal(isValidWebsiteUrl("https://www.braelodge.com/"), true);
  assert.equal(isValidWebsiteUrl("  https://www.braelodge.com/  "), true); // strips whitespace
  assert.equal(isValidWebsiteUrl("http://example.com"), true);
});

test("isValidWebsiteUrl rejects empty, javascript:, ftp: and non-URL strings", () => {
  assert.equal(isValidWebsiteUrl(""), false);
  assert.equal(isValidWebsiteUrl(undefined), false);
  assert.equal(isValidWebsiteUrl(null), false);
  assert.equal(isValidWebsiteUrl("javascript:alert(1)"), false);
  assert.equal(isValidWebsiteUrl("ftp://x"), false);
  assert.equal(isValidWebsiteUrl("not a url"), false);
});

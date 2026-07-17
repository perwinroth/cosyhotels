// localeSeo(): canonical + hreflang policy for pages with genuinely translated bodies
// (die-validation SEO-signals fix 2026-07-17). Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

import { TRANSLATED_LOCALES, localeSeo } from "../src/lib/i18n/seoLocale";

test("sv (a translated locale) gets a self-referencing canonical", () => {
  const { canonical } = localeSeo("sv", "/cosy-hotels/in/sweden");
  assert.equal(canonical, "/sv/cosy-hotels/in/sweden");
});

test("sv gets hreflang alternates: en, sv, and x-default -> en", () => {
  const { languages } = localeSeo("sv", "/cosy-hotels/in/sweden");
  assert.deepEqual(languages, {
    en: "/en/cosy-hotels/in/sweden",
    sv: "/sv/cosy-hotels/in/sweden",
    "x-default": "/en/cosy-hotels/in/sweden",
  });
});

test("an untranslated locale (fr) still canonicalizes to the /en twin, no hreflang", () => {
  const { canonical, languages } = localeSeo("fr", "/cosy-hotels/in/sweden");
  assert.equal(canonical, "/en/cosy-hotels/in/sweden");
  assert.equal(languages, undefined);
});

test("en itself canonicalizes to /en (not a translated-locale self-reference)", () => {
  const { canonical, languages } = localeSeo("en", "/cosy-hotels/in/sweden");
  assert.equal(canonical, "/en/cosy-hotels/in/sweden");
  assert.equal(languages, undefined);
});

test("TRANSLATED_LOCALES contains exactly the founder-authorized set (sv only, 2026-07-16)", () => {
  assert.deepEqual([...TRANSLATED_LOCALES], ["sv"]);
});

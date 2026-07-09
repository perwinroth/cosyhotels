import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLinkTokens } from "../src/components/growth/Linkify";

const links = (s: string) => splitLinkTokens(s).filter((t) => t.type === "link").map((t) => [t.value, t.href]);

test("board text linkifies bare domains, site paths, emails and full URLs", () => {
  assert.deepEqual(
    links("Go to insights.ehotelier.com/submit-an-article and link /en/make-your-hotel-look-cosy."),
    [
      ["insights.ehotelier.com/submit-an-article", "https://insights.ehotelier.com/submit-an-article"],
      ["/en/make-your-hotel-look-cosy", "/en/make-your-hotel-look-cosy"],
    ]
  );
  assert.deepEqual(links("Route: jennifer@afar.com"), [["jennifer@afar.com", "mailto:jennifer@afar.com"]]);
  assert.deepEqual(links("See https://gotcosy.com/en/cosy-index, then reply."), [["https://gotcosy.com/en/cosy-index", "https://gotcosy.com/en/cosy-index"]]);
});

test("scores and plain prose never become links", () => {
  assert.deepEqual(links("6.30 vs 6.01 across 17,727 hotels."), []);
  assert.deepEqual(links("No links here at all."), []);
});

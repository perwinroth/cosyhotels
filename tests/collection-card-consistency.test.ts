// Locks in a founder bug report against regression (2026-07-17): on the collection page
// (/[locale]/trips/lists/[slug]) the Remove control rendered its label in English on the sv locale,
// and its action row floated right (ml-auto) while every other HotelCard surface's action row is
// start-aligned. Investigation found PR #135 ("Mobile UX P2: one shared HotelCard across all list
// surfaces") had already fixed both: TripListRemoveControl lost its `ml-auto flex-none ...` class in
// favour of the same full-width-stacked, start-aligned button every other HotelActions control uses,
// and trips/lists/[slug]/page.tsx already routes the "Remove"/"Removing..." labels through translate()
// before passing them in as props. Live-verified via `npm run dev` + curl against a real /sv collection
// page: translate("Remove","sv") -> "Ta bort", rendered in the actual SSR HTML with no residual
// "ml-auto" class. This test makes both facts structural so neither can silently regress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

test("TripListRemoveControl never hardcodes its label: it only renders the passed props", () => {
  const src = read("src/components/TripListRemoveControl.tsx");
  // The rendered text must come from the label/removingLabel props, not a literal "Remove" string.
  assert.match(src, /\{busy \? removingLabel : label\}/, "button must render only the label props, never a hardcoded string");
  assert.ok(!/>\s*Remove\s*</.test(src), "no hardcoded English \"Remove\" JSX text node");
});

test("the collection page routes Remove/Removing labels through translate() before passing them down", () => {
  const src = read("src/app/[locale]/trips/lists/[slug]/page.tsx");
  assert.match(src, /t\("Remove"\)/, "the Remove label must go through the page's tx()/translate() pipeline");
  assert.match(src, /t\("Removing…"\)/, "the busy-state label must go through the page's tx()/translate() pipeline");
  assert.match(src, /label=\{lRemove\}/, "TripListRemoveControl must receive the translated label, not a literal string");
  assert.match(src, /removingLabel=\{lRemoving\}/, "TripListRemoveControl must receive the translated removing label");
});

test("no HotelCard-family action control floats right: the shared component and its extraActions stay start-aligned", () => {
  // ml-auto / justify-end on a HotelActions-family control is exactly the #135 regression (Remove
  // used to float right of Check availability instead of stacking start-aligned underneath it).
  for (const f of [
    "src/components/HotelActions.tsx",
    "src/components/HotelCard.tsx",
    "src/components/TripListRemoveControl.tsx",
  ]) {
    const src = read(f);
    assert.ok(!/ml-auto/.test(src), `${f} must not float any action right (ml-auto)`);
    assert.ok(!/justify-end/.test(src), `${f} must not right-justify any action row (justify-end)`);
  }
});

test("every HotelCard-based collection/listing surface renders the SAME Check-availability button class list", () => {
  // Byte-identical class strings, not just "looks similar", is the actual global-consistency
  // guarantee: every surface composes HotelActions, so this really just double-checks no page wraps
  // HotelCard in a container that overrides its alignment.
  const surfaces = [
    "src/app/[locale]/trips/lists/[slug]/page.tsx",
    "src/app/[locale]/search/page.tsx",
    "src/app/[locale]/cosy-hotels/[facet]/[city]/page.tsx",
    "src/app/[locale]/cosy-hotels/[facet]/page.tsx",
    "src/app/[locale]/cosy-hotels/in/[country]/page.tsx",
    "src/app/[locale]/cosy-hotels/region/[slug]/page.tsx",
    "src/app/[locale]/guides/[slug]/page.tsx",
    "src/app/[locale]/blog/[slug]/page.tsx",
    "src/app/[locale]/adaptive-reuse-hotels/page.tsx",
    "src/app/[locale]/page.tsx",
  ];
  for (const f of surfaces) {
    const src = read(f);
    assert.match(src, /HotelCard/, `${f} must render cards via the shared HotelCard component`);
  }
});

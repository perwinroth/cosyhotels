// Booking-CTA policy (founder, 2026-07-16): a real-browser sweep of Stay22's "Check availability"
// link showed it lands on the exact hotel only ~59% of the time, ~36% on a generic city search,
// ~4% on a DIFFERENT hotel. Single source of truth: src/lib/ctaPolicy.ts resolveBookingCta, used
// by every listing card + the hotel detail page (via HotelActions) so the swap is measurable via
// data-cta and never drifts surface-to-surface. Node built-in runner: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBookingCta } from "../src/lib/ctaPolicy";

const STAY22 = "https://www.stay22.com/allez/roam?aid=x&hotelname=Brae+Lodge";

test("resolveBookingCta picks the hotel's own website when it is real", () => {
  const cta = resolveBookingCta("https://www.braelodge.com/", STAY22);
  assert.equal(cta.mode, "website");
  assert.equal(cta.href, "https://www.braelodge.com/");
  assert.equal(cta.label, "Visit hotel website");
  assert.equal(cta.dataCta, "hotel_website");
  assert.equal(cta.rel, "noopener nofollow");
});

test("resolveBookingCta falls back to Stay22, relabeled, when there is no real website", () => {
  for (const website of [null, undefined, "", "not a url", "https://www.booking.com/hotel/gb/x.html"]) {
    const cta = resolveBookingCta(website, STAY22);
    assert.equal(cta.mode, "stay22");
    assert.equal(cta.href, STAY22);
    assert.equal(cta.label, "Check nearby stays");
    assert.equal(cta.dataCta, "check_nearby");
    assert.equal(cta.rel, "noopener nofollow sponsored");
  }
});

test("resolveBookingCta never renders BOTH a website and a Stay22 button (single CTA, mutually exclusive)", () => {
  const withSite = resolveBookingCta("https://example-inn.com", STAY22);
  const withoutSite = resolveBookingCta(null, STAY22);
  assert.notEqual(withSite.mode, withoutSite.mode);
  // Exactly one href/label/dataCta triple is returned per call — there is no second CTA to render.
  assert.equal(typeof withSite.href, "string");
  assert.equal(typeof withoutSite.href, "string");
});

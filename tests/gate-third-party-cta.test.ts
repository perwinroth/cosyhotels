// G15 CTA Trust Gate (D-0009, founder decision 2026-07-18, memory/decisions/D-0009-trust-gates-2026-07-18.md):
// the 2026-07-16/17 incident was Stay22 buttons landing on the WRONG hotel (6k unverified CTAs, a
// hotelier complaint) because the booking-CTA decision was not a single, verifiable choke point.
// src/lib/ctaPolicy.ts's resolveBookingCta() + getStay22WrongSlugs() became that single source of
// truth (locked by tests/ctaPolicy.test.ts), and src/components/HotelActions.tsx is the ONLY place
// that renders resolveBookingCta's decision onto an <a href>. This gate makes that structural, so a
// future page/card can never wire a raw Stay22/website link that bypasses the verified-wrong check.
// Grep-based against source, same style as tests/collection-card-consistency.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

// ── every public listing surface that builds a Stay22 deep link and shows a booking CTA ────────────
// (found via `grep -rln stay22AllezUrl src` / `grep -rln resolveBookingCta src` — re-run those if this
// list ever looks short after adding a new listing surface).
const LISTING_SURFACES = [
  "src/app/[locale]/page.tsx",
  "src/app/[locale]/search/page.tsx",
  "src/app/[locale]/cosy-hotels/[facet]/page.tsx",
  "src/app/[locale]/cosy-hotels/[facet]/[city]/page.tsx",
  "src/app/[locale]/cosy-hotels/in/[country]/page.tsx",
  "src/app/[locale]/cosy-hotels/region/[slug]/page.tsx",
  "src/app/[locale]/guides/[slug]/page.tsx",
  "src/app/[locale]/adaptive-reuse-hotels/page.tsx",
  "src/app/[locale]/trips/lists/[slug]/page.tsx",
];

// blog/[slug] doesn't build its own stay22Href per-render (its picks carry a pre-built `cta` field
// from the same pattern as guides) but it DOES call resolveBookingCta directly for the affiliate-
// disclosure gate, so it belongs in the "only via the sanctioned path" checks below too.
const RESOLVE_CTA_CALLERS = ["src/app/[locale]/blog/[slug]/page.tsx", "src/app/[locale]/hotels/[slug]/page.tsx"];

// Internal, noindexed, founder-only owner tool (src/app/grade/page.tsx: `robots: { index: false,
// follow: false }`, "Owner tool, noindexed" per its own header comment). It renders a raw Stay22 link
// for link-accuracy AUDITING, not as a public booking CTA, so it is deliberately outside this gate's
// scope — never add a real public listing surface here to silence a finding.
const NON_PUBLIC_ALLOWLIST = ["src/app/grade/page.tsx"];

test("every listing surface renders its Stay22 deep link ONLY as the stay22Href prop into HotelCard/HotelActions, never as a raw href", () => {
  for (const f of LISTING_SURFACES) {
    const src = read(f);
    assert.match(src, /\bimport HotelCard from ["']@\/components\/HotelCard["']/, `${f} must render hotel cards via the shared HotelCard component`);
    assert.match(src, /\bstay22Href=\{/, `${f} must pass its Stay22 link into HotelCard as the stay22Href prop`);
  }
});

test("the hotel detail page renders its booking CTA ONLY via HotelActions, and computes the verified-wrong decision via resolveBookingCta", () => {
  const f = "src/app/[locale]/hotels/[slug]/page.tsx";
  const src = read(f);
  assert.match(src, /\bimport HotelActions from ["']@\/components\/HotelActions["']/, `${f} must render its CTA via the shared HotelActions component`);
  assert.match(src, /<HotelActions\b[^]*?stay22Href=\{bookingUrl\}/, `${f} must pass the Stay22 link into HotelActions as stay22Href`);
  assert.match(src, /\bimport \{ resolveBookingCta, getStay22WrongSlugs \} from ["']@\/lib\/ctaPolicy["']/, `${f} must import the single-source-of-truth CTA policy, not reimplement the decision`);
});

test("every direct resolveBookingCta caller (surfaces that don't compose HotelCard/HotelActions for this decision) imports it from ctaPolicy.ts, not a local reimplementation", () => {
  for (const f of RESOLVE_CTA_CALLERS) {
    const src = read(f);
    assert.match(
      src,
      /\bimport \{[^}]*\bresolveBookingCta\b[^}]*\} from ["']@\/lib\/ctaPolicy["']/,
      `${f} must import resolveBookingCta from @/lib/ctaPolicy, not reimplement the CTA decision`,
    );
    assert.match(src, /\bresolveBookingCta\(/, `${f} must actually call resolveBookingCta`);
  }
});

test("resolveBookingCta is imported ONLY from src/lib/ctaPolicy.ts (no shadow/duplicate implementation anywhere else)", () => {
  const declSrc = read("src/lib/ctaPolicy.ts");
  assert.match(declSrc, /export function resolveBookingCta\(/, "src/lib/ctaPolicy.ts must still define resolveBookingCta");

  function walk(dir: string, out: string[]) {
    for (const entry of readdirSync(join(root, dir))) {
      if (entry === "node_modules" || entry === ".next") continue;
      const rel = join(dir, entry);
      const st = statSync(join(root, rel));
      if (st.isDirectory()) walk(rel, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(rel);
    }
  }
  const allSrcFiles: string[] = [];
  walk("src", allSrcFiles);

  for (const rel of allSrcFiles) {
    if (rel === "src/lib/ctaPolicy.ts") continue;
    const src = read(rel);
    if (/export function resolveBookingCta\(/.test(src)) {
      assert.fail(`${rel} defines its own resolveBookingCta — the CTA decision must have exactly one implementation (src/lib/ctaPolicy.ts)`);
    }
  }
});

test("stay22AllezUrl's raw string output is never rendered directly as an <a href> outside HotelActions.tsx (the one sanctioned render point)", () => {
  // The dangerous shape this guards against: a listing surface builds `const cta = stay22AllezUrl(...)`
  // (or `bookingUrl`, or destructures `h.cta`/`p.cta` from a pre-built pick) and then renders
  // `<a href={cta}>` directly, bypassing resolveBookingCta's verified-wrong swap entirely — exactly
  // the class of bug D-0009 was written to prevent structurally. `href={x.href}` (resolveBookingCta's
  // OWN returned object, rendered only inside HotelActions.tsx) is the one allowed shape and is
  // excluded by requiring the identifier NOT be followed by `.href`.
  const RAW_HREF = /\bhref=\{\s*(?:[a-zA-Z_$][\w$]*\.)?(cta|stay22Href|bookingUrl)\s*\}/g;

  function walk(dir: string, out: string[]) {
    for (const entry of readdirSync(join(root, dir))) {
      if (entry === "node_modules" || entry === ".next") continue;
      const rel = join(dir, entry);
      const st = statSync(join(root, rel));
      if (st.isDirectory()) walk(rel, out);
      else if (entry.endsWith(".tsx")) out.push(rel);
    }
  }
  const allTsx: string[] = [];
  walk("src", allTsx);

  const violations: string[] = [];
  for (const rel of allTsx) {
    if (rel === "src/components/HotelActions.tsx") continue; // the one sanctioned render point
    if (NON_PUBLIC_ALLOWLIST.includes(rel)) continue;
    const src = read(rel);
    for (const m of src.matchAll(RAW_HREF)) {
      // href={x.href} (dot-qualified) is fine anywhere — it's reading a resolveBookingCta result's
      // .href field, not a raw stay22AllezUrl string. Only the bare/dot-into-cta forms are unsafe.
      const full = m[0];
      if (/\.\w+\.href\s*\}$/.test(full) || /\.href\s*\}$/.test(full)) continue;
      violations.push(`${rel}: ${full}`);
    }
  }
  assert.deepEqual(violations, [], `raw stay22/booking href rendered outside HotelActions.tsx: ${violations.join("; ")}`);
});

test("HotelActions.tsx renders the CTA via resolveBookingCta's returned .href field (the sanctioned indirection), not a bare prop", () => {
  const src = read("src/components/HotelActions.tsx");
  assert.match(src, /\bimport \{ resolveBookingCta \} from ["']@\/lib\/ctaPolicy["']/, "HotelActions must import resolveBookingCta from ctaPolicy.ts");
  assert.match(src, /const cta = resolveBookingCta\(/, "HotelActions must compute the CTA via resolveBookingCta");
  assert.match(src, /href=\{cta\.href\}/, "the rendered <a> must use resolveBookingCta's returned .href, never the raw stay22Href prop directly");
});

test("getStay22WrongSlugs fails safe to an empty set on any query error (structural: the catch/error branches exist in source)", () => {
  const src = read("src/lib/ctaPolicy.ts");
  assert.match(
    src,
    /if \(error\) \{[^}]*slugs: new Set\(\)[^}]*\}/s,
    "a Supabase query error (e.g. missing stay22_checks table) must reset the cache to an empty Set, never leave a stale/partial one",
  );
  assert.match(
    src,
    /\} catch \{[^}]*slugs: new Set\(\)[^}]*\}/s,
    "a thrown error (network failure etc.) must also fail safe to an empty Set via a catch block",
  );
  // Fail-safe means "no verdicts known" -> every hotel renders its untouched default CTA, so this
  // must never be able to suppress the Stay22 button that earns affiliate revenue today.
  assert.match(src, /must never be able to suppress/, "the fail-safe contract must stay documented in source, not just in this test");
});

test("resolveBookingCta's default branch (no verdict / not verified wrong) is untouched Stay22, matching the founder FINAL rule", () => {
  const src = read("src/lib/ctaPolicy.ts");
  assert.match(src, /label: "Check availability"/, "the default CTA label must remain the pre-existing 'Check availability'");
  assert.match(src, /dataCta: "check_availability"/, "the default data-cta must remain 'check_availability'");
});

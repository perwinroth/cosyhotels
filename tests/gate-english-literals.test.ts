// G15b Trust Gate (D-0009, founder decision 2026-07-18, memory/decisions/D-0009-trust-gates-2026-07-18.md):
// "[locale] pages may not add hardcoded reader-facing English literals outside the translate()/label-
// plumbing patterns." A real parser-grade check (walk the JSX tree, resolve every text node) is out of
// scope for a fast CI gate; this is the pragmatic version — a RATCHET.
//
// How it works:
//  1. Scope = every src/app/[locale]/**/page.tsx that ALREADY routes copy through translate()/tx (it
//     imports "@/lib/i18n/translate", calls translate(...), or uses the shareLabels/buildShareLabels
//     helper). A page that has never been wired for translation is out of scope for this gate — that's
//     a bigger, tracked, separate migration, not something this ratchet should block on.
//  2. For each in-scope file, count "suspicious" JSX text literals: a regex match of a `>...<` text
//     node (comments stripped first) whose content is 3+ space-separated prose-looking words, contains
//     no `{`/`}` (a data interpolation breaks the match, which is the "excluding data interpolations"
//     rule), and reads like real English prose (starts capitalized, only prose punctuation, no digits).
//  3. That count is compared against tests/fixtures/gate-english-literals-baseline.json. The count may
//     go DOWN (more copy got wired through translate — great, tighten the baseline in the same PR) but
//     may never go UP.
//
// Update procedure (read this before touching the baseline):
//  - New hardcoded English literal on an in-scope page? Wire it through translate()/tx() instead of
//    bumping the baseline. That is the fix this gate exists to force.
//  - Baseline count for a file went DOWN because you fixed strays? Lower that file's number in the
//    baseline JSON in the SAME PR (ratchets only tighten).
//  - Genuinely reviewed the new literal and it's fine to stay hardcoded (e.g. a brand name, a technical
//    fallback string never meant to localize)? Raise that ONE file's baseline number in the SAME PR,
//    with a one-line reason in the PR description — never round-trip through this file to hide a
//    review gap. There is no "regenerate baseline" script by design: every increase must be a reviewed,
//    visible diff of the JSON.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(__dirname, "..");
const baselinePath = join(__dirname, "fixtures/gate-english-literals-baseline.json");

function stripComments(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inBlock = false;
  for (let line of lines) {
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) continue;
      line = line.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const bStart = line.indexOf("/*");
      if (bStart === -1) break;
      const bEnd = line.indexOf("*/", bStart + 2);
      if (bEnd === -1) {
        line = line.slice(0, bStart);
        inBlock = true;
        break;
      }
      line = line.slice(0, bStart) + line.slice(bEnd + 2);
    }
    const m = line.match(/(?<!:)\/\//);
    if (m && m.index !== undefined) line = line.slice(0, m.index);
    out.push(line);
  }
  return out.join("\n");
}

// A JSX text node that "reads like English prose": capitalized start, only prose punctuation, no
// digits, no code symbols (`;`, `=`, parens-as-calls, camelCase runs) — this is deliberately strict so
// the ratchet is stable (doesn't flap on unrelated code edits near a `<`/`>` comparison or generic).
const PROSE = /^[A-Z][A-Za-zÀ-ɏ'’.,:;&%\-/ ]{9,}$/;
const TEXT_NODE = />([^<>{}]{1,300})</g;

function countSuspiciousLiterals(text: string): { count: number; samples: string[] } {
  const stripped = stripComments(text);
  let m: RegExpExecArray | null;
  let count = 0;
  const samples: string[] = [];
  TEXT_NODE.lastIndex = 0;
  while ((m = TEXT_NODE.exec(stripped))) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (!t) continue;
    const words = t.split(" ").filter(Boolean);
    if (words.length >= 3 && PROSE.test(t)) {
      count++;
      if (samples.length < 5) samples.push(t.slice(0, 90));
    }
  }
  return { count, samples };
}

// "Already routes copy through translate()/tx/label-builders" — the scope test for this gate.
const TRANSLATE_WIRED = /from ["']@\/lib\/i18n\/translate["']|\btranslate\(|buildShareLabels|shareLabels/;

function walkPageTsx(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkPageTsx(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
}

function inScopeLocaleFiles(): string[] {
  const all: string[] = [];
  walkPageTsx(join(root, "src/app/[locale]"), all);
  return all
    .map((f) => relative(root, f).split("\\").join("/"))
    .filter((rel) => TRANSLATE_WIRED.test(readFileSync(join(root, rel), "utf8")))
    .sort();
}

test("hardcoded reader-facing English literal count per translate-wired [locale] page never exceeds its checked-in baseline", () => {
  const baseline: Record<string, number> = JSON.parse(readFileSync(baselinePath, "utf8"));
  const scoped = inScopeLocaleFiles();
  assert.ok(scoped.length > 10, `sanity: expected 10+ translate-wired [locale] pages, found ${scoped.length}`);

  const overages: string[] = [];
  for (const rel of scoped) {
    const { count, samples } = countSuspiciousLiterals(readFileSync(join(root, rel), "utf8"));
    const allowed = baseline[rel] ?? 0; // a qualifying file with no baseline entry defaults to 0
    if (count > allowed) {
      overages.push(
        `  ${rel}: ${count} suspicious literal(s), baseline allows ${allowed}\n` +
          samples.map((s) => `      "${s}"`).join("\n"),
      );
    }
  }

  if (overages.length > 0) {
    assert.fail(
      `${overages.length} file(s) exceeded their English-literal baseline (D-0009 G15b). Wire new copy ` +
        `through translate()/tx(), or — only after a real review — raise that file's number in ` +
        `tests/fixtures/gate-english-literals-baseline.json in this same PR:\n${overages.join("\n")}`,
    );
  }
});

test("the baseline has no stale entries for files that no longer qualify (removed page, or no longer translate-wired)", () => {
  const baseline: Record<string, number> = JSON.parse(readFileSync(baselinePath, "utf8"));
  const scoped = new Set(inScopeLocaleFiles());
  const stale = Object.keys(baseline).filter((f) => !scoped.has(f));
  assert.deepEqual(stale, [], `stale baseline entries (delete these rows): ${stale.join(", ")}`);
});

// G15a Trust Gate (D-0009, founder decision 2026-07-18, memory/decisions/D-0009-trust-gates-2026-07-18.md):
// the 2026-07-17 incident was 10,071 em dashes hidden inside JS/JSON unicode escapes (—) that a
// plain grep for the literal character missed. This gate scans every reader-facing source (src/data
// content files + src/app/**/page.tsx) for BOTH the literal em/en dash characters and their escape
// forms, so the class of bug (not just the literal character) can never silently return.
//
// Rule (D-0009 verbatim): em dash is never allowed in reader-facing copy. En dash is allowed ONLY in
// a numeric/time range (0-10, 10am-3pm, 1700s-1800s, {a}-{b} JSX interpolation); every other en dash
// must be rewritten (comma, colon, "to", "|", ASCII hyphen — see PR history for the 2026-07-18
// cleanup of the ~170 stragglers this gate found on first run) or, for genuinely non-reader-facing
// internal data, explicitly allowlisted below with a one-line reason. Code comments are exempt (they
// are never rendered) but a NEW file must not rely on that — comment-only "compliance" would still
// leak the moment the string moves into a template literal.
//
// The digit-range predicate mirrors scripts/lib/copyClean.mjs's stripNonRangeEnDash — keep both in
// sync if the range definition ever changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(__dirname, "..");

// Needles built from code points, not literal characters, so this test file itself never contains a
// banned character (that would be self-defeating and would trip any future literal-grep audit).
const EM = String.fromCharCode(0x2014); // —
const EN = String.fromCharCode(0x2013); // –
const EM_ESCAPE = "\\u2014"; // the literal 6-character escape sequence as it appears in source text
const EN_ESCAPE = "\\u2013";

// ── file-level allowlist: NON-reader-facing internal data, never rendered to a site visitor ───────
// Each entry needs a one-line reason. Do not add a file here to silence a real reader-facing leak —
// fix the copy instead (see the cleanup this gate's first run produced, PR "Trust Gates CI").
const ALLOWLIST_DATA_FILES = new Set<string>([
  // Editor/journalist pitch-route notes for the founder's own PR outreach queue (src/app/growth/pr) —
  // internal targeting research, never rendered on any public gotcosy.com page.
  "src/data/outreach.json",
  // Same lane: per-target PR action queue + verification notes (src/app/growth/pr), internal only.
  "src/data/prActions.ts",
  // Feeds ONLY src/app/growth/data-brief (noindexed founder ops board, see ALLOWLIST_APP_PREFIXES).
  "src/data/dataBriefCampaign.ts",
]);

// Any src/app/**/page.tsx whose path starts with one of these prefixes is a founder-only internal
// tool: noindex/nofollow + middleware-panel-gated (verified: src/app/growth/layout.tsx sets
// `robots: { index: false, follow: false }` and is literally titled "Got Cosy internal"), not reader
// copy. Public marketing/product surfaces are never added here.
const ALLOWLIST_APP_PREFIXES = ["src/app/growth/"];

// ── digit/time/decade-range predicate: the ONLY en-dash exemption ──────────────────────────────────
// A dash (literal OR escaped — both are just "the character/sequence at [start, start+len)") is a
// "range" dash if there's a digit within 6 characters on BOTH sides (covers "0-10", "10am-3pm",
// "1700s-1800s", "9.30am-11am", and the escaped "0–10" form), OR it sits directly between a JSX
// close/open brace (`{a}-{b}`, an interpolated numeric range, e.g. cosiest-hotel-towns' meanSpread
// display). Position-based (not regex-with-the-dash-embedded) so it works identically for the
// literal character and its multi-character escape sequence.
const DASH_CHARS = new RegExp(`[${EN}${EM}]`);
const NEAR = 6;

function sideHasDigit(segment: string, closestEnd: "start" | "end"): boolean {
  // If another dash sits inside this window, only look at the part between it and OUR dash — a
  // digit on the far side of a different dash doesn't make this a range.
  if (closestEnd === "start") {
    // "before" window: keep only the tail after the last OTHER dash in it (rightmost match).
    const idx = segment.split("").reduceRight((acc, ch, i) => (acc === -1 && DASH_CHARS.test(ch) ? i : acc), -1);
    const seg = idx === -1 ? segment : segment.slice(idx + 1);
    return /\d/.test(seg);
  } else {
    const idx = segment.search(DASH_CHARS); // "after" window: keep only the head before the next other dash
    const seg = idx === -1 ? segment : segment.slice(0, idx);
    return /\d/.test(seg);
  }
}

function isAllowedEnDashAt(text: string, start: number, len: number): boolean {
  const before = text.slice(Math.max(0, start - NEAR), start);
  const after = text.slice(start + len, start + len + NEAR);
  if (sideHasDigit(before, "start") && sideHasDigit(after, "end")) return true;
  return text[start - 1] === "}" && text[start + len] === "{";
}

// ── comment stripping for .ts/.tsx (JSON has no comments; scanned raw) ─────────────────────────────
// Line comments are stripped from the `//` that is not part of `://` (so URLs survive); block
// comments /* … */ are stripped including simple multi-line spans. This is a lint-grade heuristic,
// not a parser — good enough because the codebase's comment style never nests `//`-after-`://` inside
// a comment, and code-review + this gate together catch anything it misses.
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

type Finding = { file: string; kind: string; context: string };

function scanText(relPath: string, rawText: string, isCode: boolean): Finding[] {
  const text = isCode ? stripComments(rawText) : rawText; // JSON: scan raw, no comment syntax exists
  const findings: Finding[] = [];
  const ctx = (i: number, len: number) => text.slice(Math.max(0, i - 40), i + len + 40).replace(/\n/g, " ");

  for (let i = text.indexOf(EM); i !== -1; i = text.indexOf(EM, i + 1)) {
    findings.push({ file: relPath, kind: "em dash (literal)", context: ctx(i, 1) });
  }
  for (let i = text.indexOf(EM_ESCAPE); i !== -1; i = text.indexOf(EM_ESCAPE, i + 1)) {
    findings.push({ file: relPath, kind: "em dash (\\u2014 escape)", context: ctx(i, EM_ESCAPE.length) });
  }
  for (let i = text.indexOf(EN); i !== -1; i = text.indexOf(EN, i + 1)) {
    if (!isAllowedEnDashAt(text, i, 1)) {
      findings.push({ file: relPath, kind: "en dash (literal, non-range)", context: ctx(i, 1) });
    }
  }
  for (let i = text.indexOf(EN_ESCAPE); i !== -1; i = text.indexOf(EN_ESCAPE, i + 1)) {
    if (!isAllowedEnDashAt(text, i, EN_ESCAPE.length)) {
      findings.push({ file: relPath, kind: "en dash (\\u2013 escape, non-range)", context: ctx(i, EN_ESCAPE.length) });
    }
  }
  return findings;
}

function walkPageTsx(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkPageTsx(full, out);
    else if (entry === "page.tsx") out.push(full);
  }
}

function collectTargets(): { path: string; rel: string; isCode: boolean }[] {
  const targets: { path: string; rel: string; isCode: boolean }[] = [];

  // src/data/*.ts and *.json — flat directory, not recursive (matches the repo's actual layout:
  // guides.ts, blogPosts.ts, blogPicks.json, hotelFaqs.json, regions.ts, discoveryOverrides.ts,
  // tripBoards.ts, cityGuides.ts, ...).
  const dataDir = join(root, "src/data");
  for (const entry of readdirSync(dataDir)) {
    if (!entry.endsWith(".ts") && !entry.endsWith(".json")) continue;
    const rel = relative(root, join(dataDir, entry)).split("\\").join("/");
    if (ALLOWLIST_DATA_FILES.has(rel)) continue;
    targets.push({ path: join(dataDir, entry), rel, isCode: entry.endsWith(".ts") });
  }

  // src/app/**/page.tsx, recursively.
  const pageFiles: string[] = [];
  walkPageTsx(join(root, "src/app"), pageFiles);
  for (const full of pageFiles) {
    const rel = relative(root, full).split("\\").join("/");
    if (ALLOWLIST_APP_PREFIXES.some((p) => rel.startsWith(p))) continue;
    targets.push({ path: full, rel, isCode: true });
  }

  return targets;
}

test("no em/en dashes (literal or unicode-escaped) in reader-facing src/data + page.tsx sources, outside allowed numeric ranges", () => {
  const targets = collectTargets();
  assert.ok(targets.length > 50, `sanity: expected 50+ scanned files, found ${targets.length} — the walker is probably broken`);

  const allFindings: Finding[] = [];
  for (const t of targets) {
    const raw = readFileSync(t.path, "utf8");
    allFindings.push(...scanText(t.rel, raw, t.isCode));
  }

  if (allFindings.length > 0) {
    const report = allFindings
      .slice(0, 30)
      .map((f) => `  ${f.file} [${f.kind}]: ...${f.context}...`)
      .join("\n");
    const more = allFindings.length > 30 ? `\n  ...and ${allFindings.length - 30} more` : "";
    assert.fail(
      `${allFindings.length} banned dash occurrence(s) found (D-0009 G15a). Fix the copy (comma/colon/"to"/"|"/ASCII hyphen, ` +
        `matching scripts/lib/copyClean.mjs conventions), or if genuinely non-reader-facing add a justified entry to ` +
        `ALLOWLIST_DATA_FILES/ALLOWLIST_APP_PREFIXES in this test:\n${report}${more}`,
    );
  }
});

test("the allowlists only reference files/prefixes that actually exist (no silently-dead allowlist entries)", () => {
  for (const rel of ALLOWLIST_DATA_FILES) {
    assert.doesNotThrow(() => statSync(join(root, rel)), `allowlisted data file missing: ${rel}`);
  }
  const pageFiles: string[] = [];
  walkPageTsx(join(root, "src/app"), pageFiles);
  for (const prefix of ALLOWLIST_APP_PREFIXES) {
    const hasAny = pageFiles.some((f) => relative(root, f).split("\\").join("/").startsWith(prefix));
    assert.ok(hasAny, `allowlisted app prefix matches no page.tsx: ${prefix}`);
  }
});

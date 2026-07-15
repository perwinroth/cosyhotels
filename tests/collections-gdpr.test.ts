// Regression suite for the GDPR compliance layer added on top of the find-my-collections magic
// link feature (unsubscribe, right-to-be-forgotten erasure, privacy-page rewrite). Runs with the
// Node built-in runner, zero new deps: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { listUnsubscribeHeaders } from "../src/lib/email/resend";
import { hashToken } from "../src/lib/savedLists";

const root = (...parts: string[]) => join(__dirname, "..", ...parts);
const read = (rel: string) => readFileSync(root(rel), "utf8");

// ── listUnsubscribeHeaders (RFC 8058 one-click unsubscribe) ──

test("listUnsubscribeHeaders wraps the URL in angle brackets and declares one-click", () => {
  const headers = listUnsubscribeHeaders("https://gotcosy.com/en/collections/unsubscribe?token=abc");
  assert.equal(headers["List-Unsubscribe"], "<https://gotcosy.com/en/collections/unsubscribe?token=abc>");
  assert.equal(headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

// ── /api/collections/forget: same hashing contract as the magic-link view page ──

test("hashToken is deterministic, so the forget route can re-derive the same lookup key as the view page", () => {
  const raw = "some-raw-access-token";
  assert.equal(hashToken(raw), hashToken(raw));
  assert.notEqual(hashToken(raw), raw, "the raw token itself must never be the stored key");
});

// ── Structural guards over the new source files ──

const NEW_SOURCE_FILES = [
  "src/app/[locale]/collections/unsubscribe/page.tsx",
  "src/app/api/collections/forget/route.ts",
  "src/components/CollectionsForgetButton.tsx",
  "src/app/[locale]/privacy/page.tsx",
  "src/lib/email/resend.ts",
  "src/lib/collectionStore.ts",
  "src/app/[locale]/collections/view/page.tsx",
];

test("no new GDPR-layer editorial/comment string contains an em dash or en dash", () => {
  for (const f of NEW_SOURCE_FILES) {
    const src = read(f);
    assert.ok(!src.includes("—"), `${f} must not contain an em dash`);
    assert.ok(!src.includes("–"), `${f} must not contain an en dash`);
  }
});

test("the unsubscribe page is noindex and force-dynamic (must reflect live DB state on every hit)", () => {
  const src = read("src/app/[locale]/collections/unsubscribe/page.tsx");
  assert.match(src, /dynamic\s*=\s*["']force-dynamic["']/);
  assert.match(src, /robots:\s*\{\s*index:\s*false/);
});

test("the unsubscribe page looks up email_contacts by unsubscribe_token, never by email", () => {
  const src = read("src/app/[locale]/collections/unsubscribe/page.tsx");
  assert.match(src, /from\(["']email_contacts["']\)/);
  assert.match(src, /eq\(["']unsubscribe_token["'],\s*rawToken\)/);
  assert.ok(!/eq\(["']email["']/.test(src), "must never look up by email directly (that would let a token holder probe other emails)");
});

test("the unsubscribe write sets marketing_consent false and unsubscribed_at, and is written idempotently", () => {
  const src = read("src/app/[locale]/collections/unsubscribe/page.tsx");
  assert.match(src, /marketing_consent:\s*false/);
  assert.match(src, /unsubscribed_at:\s*now/);
  // Idempotence: the write is gated behind "if the row is not already unsubscribed", not unconditional.
  assert.match(src, /if\s*\(!row\.unsubscribed_at\)/);
});

test("the forget route hashes the incoming token and never trusts a client-supplied email", () => {
  const src = read("src/app/api/collections/forget/route.ts");
  assert.match(src, /hashToken\(rawToken\)/);
  assert.ok(!/body\.email/.test(src), "the email must only ever come from the resolved token row, never the request body");
});

test("the forget route rejects missing/expired tokens with ok:false and a 403", () => {
  const src = read("src/app/api/collections/forget/route.ts");
  assert.match(src, /ok:\s*false\s*\},\s*\{\s*status:\s*403\s*\}/);
  assert.match(src, /expires_at/);
});

test("the forget route deletes shortlists, email_contacts, and collection_access_tokens, all scoped to the resolved email", () => {
  const src = read("src/app/api/collections/forget/route.ts");
  for (const table of ["shortlists", "email_contacts", "collection_access_tokens"]) {
    const re = new RegExp(`from\\(["']${table}["']\\)\\s*\\.delete\\(\\)\\.eq\\(["']email["'],\\s*email\\)`);
    assert.match(src, re, `${table} delete must be scoped to the token-resolved email`);
  }
});

test("CollectionsForgetButton never calls window.confirm or window.alert (no native dialogs)", () => {
  const src = read("src/components/CollectionsForgetButton.tsx");
  // Strip comment lines first: the file legitimately mentions confirm()/alert() in prose to explain
  // why they are NOT used; only an actual call site would be a violation.
  const code = src
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  assert.ok(!/\bwindow\.confirm\(/.test(code) && !/[^.\w]confirm\(/.test(code));
  assert.ok(!/\bwindow\.alert\(/.test(code) && !/[^.\w]alert\(/.test(code));
});

test("the privacy page names all three sub-processors", () => {
  const src = read("src/app/[locale]/privacy/page.tsx");
  for (const name of ["Supabase", "Vercel", "Resend"]) {
    assert.ok(src.includes(name), `privacy page must name ${name}`);
  }
});

test("the privacy page enumerates all eight GDPR rights and links the self-service routes", () => {
  const src = read("src/app/[locale]/privacy/page.tsx");
  for (const right of [
    "Access", "Rectification", "Erasure", "Restriction", "Objection",
    "Withdraw consent", "Portability", "Complain",
  ]) {
    assert.ok(src.includes(right), `privacy page must enumerate the "${right}" right`);
  }
  assert.match(src, /collections\/find/, "privacy page must link the self-service find/erase route");
});

test("sendEmail forwards optional headers through to Resend without touching the existing call shape", () => {
  const src = read("src/lib/email/resend.ts");
  assert.match(src, /headers\?:\s*Record<string,\s*string>/);
  assert.match(src, /\.\.\.\(headers \? \{ headers \} : \{\}\)/);
});

test("clearCollections removes both the multi-collection store and the legacy single-collection key", () => {
  const src = read("src/lib/collectionStore.ts");
  assert.match(src, /export function clearCollections/);
  assert.match(src, /removeItem\(STORE_KEY\)/);
  assert.match(src, /removeItem\(LEGACY_KEY\)/);
});

// Saved lists v1 ("save a place to your plan") — pure, DB-free rules shared by the create/edit API
// routes and unit tests. No login: email is the identity captured at creation, edit_token is the
// secret that grants edit access via the private link. Kept separate from the route handlers
// (mirrors src/lib/trips.ts next to tripsLive.ts) so the contract is testable without a DB or the
// Next.js request/response types.
import crypto from "crypto";
import { locales, defaultLocale, type Locale } from "@/i18n/locales";

/** App-level cap on a list title. Public lists are read-only editorial-adjacent surfaces, not a
 *  free-text field, so this stays short. */
export const MAX_TITLE_LEN = 80;

/** Defensive cap on how many hotels one list can hold (abuse guard, not a product limit). */
export const MAX_ITEMS = 100;

/** A title may never carry a link — public list titles render on an indexable page and must not
 *  become a spam/redirect vector. */
const URL_LIKE = /https?:\/\/|www\.|:\/\//i;

export type TitleResult = { ok: true; title: string | null } | { ok: false; error: string };

/** Trim, cap to MAX_TITLE_LEN, and reject any title containing a URL. `undefined`/empty input is
 *  valid (a list can have no title yet) and normalizes to null. */
export function sanitizeTitle(raw: unknown): TitleResult {
  if (raw == null) return { ok: true, title: null };
  if (typeof raw !== "string") return { ok: false, error: "Title must be text" };
  const trimmed = raw.trim().slice(0, MAX_TITLE_LEN);
  if (!trimmed) return { ok: true, title: null };
  if (URL_LIKE.test(trimmed)) return { ok: false, error: "Title cannot contain a link" };
  return { ok: true, title: trimmed };
}

/** Basic, deliberately permissive email shape check (contains "@" and a "." after it). This is a
 *  spam/typo guard, not RFC-5322 validation — the email is never shown publicly, only used to
 *  identify the creator's private edit link. */
export function isValidEmail(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (s.length < 5 || s.length > 254) return false;
  const at = s.indexOf("@");
  if (at < 1 || at === s.length - 1) return false;
  const domain = s.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

/** Normalize a requested locale to one of the enabled locales, defaulting to English. */
export function normalizeLocale(raw: unknown): Locale {
  if (typeof raw === "string" && (locales as readonly string[]).includes(raw)) return raw as Locale;
  return defaultLocale;
}

/** Cryptographically-random edit token, url-safe, well over the 24-char floor (18 bytes -> 24
 *  base64url chars). Never derived from anything guessable (not the slug, not the email). */
export function generateEditToken(): string {
  return crypto.randomBytes(18).toString("base64url");
}

/** Edit authorization: legacy/anon rows (edit_token is null, predate v1) stay editable by anyone
 *  who has the slug — backward compatible. Once a row HAS an edit_token, the caller must present
 *  the exact match or the edit is refused. */
export function tokenAuthorized(rowEditToken: string | null | undefined, providedToken: unknown): boolean {
  if (!rowEditToken) return true;
  return typeof providedToken === "string" && providedToken.length > 0 && providedToken === rowEditToken;
}

/** Defensive cap for the items array (applies to add-item edits, not just create). */
export function withinItemsCap(items: string[]): boolean {
  return items.length <= MAX_ITEMS;
}

// ── Magic-link collection access (find-my-collections) ──────────────────────────────────────────
// A short-lived token emailed to a visitor who asks "find my collections by email". We store only
// its SHA-256 hash (collection_access_tokens.token_hash) so a DB read can never itself hand out a
// working link; the raw token exists only in the email and, briefly, in the request/response.

/** Minutes a minted access token stays valid. */
export const ACCESS_TOKEN_TTL_MIN = 30;
/** Max magic-link requests allowed per email within REQUEST_RATE_WINDOW_MIN. */
export const REQUEST_RATE_LIMIT = 3;
/** Rolling window (minutes) the rate limit above counts over. */
export const REQUEST_RATE_WINDOW_MIN = 15;

/** Raw, cryptographically-random access token, url-safe (24 bytes -> 32 base64url chars, over the
 *  32+ char floor). */
export function generateAccessToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** One-way hash of a presented raw token. Look up collection_access_tokens by hashToken(raw), never
 *  by the raw value itself (we never store the raw value). */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

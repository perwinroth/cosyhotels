// Hotel takedown mechanism (trust fix, 2026-07-16). Two layers, belt and braces:
//   1. DELISTED_SLUGS — a code-level Set, live the instant this deploys, no DB migration needed.
//   2. hotels.delisted_at — a DB column (sql/hotel-delist.sql, founder-run separately) checked
//      defensively: if the column does not exist yet, isDelisted() catches the error and falls
//      back to the Set alone, so this file works identically before and after the migration lands.
//
// Origin: brae-lodge (a real, small direct-booking guest house) asked for takedown because the
// Stay22 "roam" booking link on our hotel page matches the NEAREST OTA-bookable property, which for
// small direct-booking hotels can land on a DIFFERENT hotel entirely. Founder promised 24h takedown.
import type { SupabaseClient } from "@supabase/supabase-js";

export const DELISTED_SLUGS = new Set<string>(["brae-lodge"]);

// Minimal shape we need from the Supabase client — accepts the real client or a test double.
type DbLike = Pick<SupabaseClient, "from">;

/**
 * True if `slug` must never be rendered/linked/emitted anywhere (page, sitemap, outreach).
 * Checks the code-level Set first (works with no DB access at all), then defensively checks the
 * `hotels.delisted_at` column when a db client is provided — if that column doesn't exist yet
 * (pre-migration) or the query otherwise errors, this falls back to the Set-only result rather
 * than throwing, so callers never need their own try/catch.
 */
export async function isDelisted(slug: string, db?: DbLike | null): Promise<boolean> {
  const s = String(slug || "").trim();
  if (!s) return false;
  if (DELISTED_SLUGS.has(s)) return true;
  if (!db) return false;
  try {
    const { data, error } = await db
      .from("hotels")
      .select("delisted_at")
      .eq("slug", s)
      .maybeSingle();
    if (error) return false; // column may not exist yet (pre-migration) — Set-only result stands
    return !!(data as { delisted_at?: string | null } | null)?.delisted_at;
  } catch {
    return false;
  }
}

// ——— "Visit hotel website" CTA: sanitize the stored hotel.website before ever rendering it ———
// Only http(s) URLs with a dot in the host are safe to render as an outbound link (rejects empty
// strings, javascript:/data: schemes, bare words, and non-web schemes like ftp:).
export function isValidWebsiteUrl(website: string | null | undefined): boolean {
  const url = String(website || "").trim();
  if (!url) return false;
  if (!/^https?:\/\//i.test(url)) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return parsed.hostname.includes(".");
}

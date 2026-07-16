// Single source of truth for the booking-CTA decision (founder FINAL rule, 2026-07-16, verbatim
// intent: "website only when Stay22 is wrong, so you need to know"). This supersedes an earlier
// draft (same day) that made the hotel's own website primary EVERYWHERE — the founder corrected
// that before merge: Stay22 "Check availability" stays the default primary CTA everywhere it
// exists today, unchanged, and the website only replaces it for a hotel the real-browser sweep has
// actually VERIFIED wrong. Every listing card and the hotel detail page apply the IDENTICAL rule
// (via HotelActions), so the swap is measurable via data-cta and never drifts surface-to-surface.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRealHotelWebsite } from "@/lib/delisted";

export type BookingCta = {
  mode: "stay22" | "website";
  href: string;
  /** English source string; callers translate() it for non-en locales, same as every other
   *  reader-facing string in this codebase. */
  label: string;
  dataCta: "check_availability" | "hotel_website" | "check_nearby";
  rel: string;
};

/**
 * Resolve the single primary booking CTA for a hotel.
 *
 * DEFAULT (isVerifiedWrong = false — no verdict row, or verdict PENDING/EXACT/SELECTED): the
 * pre-existing behaviour, unchanged — Stay22 "Check availability", unlabelled, as it has always
 * rendered. This is the branch's whole point: the sweep only ever SUBTRACTS confidence from a
 * hotel it has actually looked at; it never changes anything about a hotel it hasn't checked yet.
 *
 * VERIFIED-WRONG (isVerifiedWrong = true — verdict WRONG_PROPERTY, CITY_SEARCH or
 * UNMATCHED_SEARCH; see getStay22WrongSlugs below): (a) the hotel has a real, non-OTA website
 * (src/lib/delisted.ts isRealHotelWebsite) → that website REPLACES Stay22 as the only booking CTA;
 * (b) no real website → Stay22 still renders (it is the only booking mechanism this hotel has) but
 * relabelled "Check nearby stays", describing what the verified-wrong landing truthfully does.
 */
export function resolveBookingCta(
  website: string | null | undefined,
  stay22Href: string,
  isVerifiedWrong = false,
): BookingCta {
  if (isVerifiedWrong) {
    if (isRealHotelWebsite(website)) {
      return {
        mode: "website",
        href: String(website).trim(),
        label: "Visit hotel website",
        dataCta: "hotel_website",
        rel: "noopener nofollow",
      };
    }
    return {
      mode: "stay22",
      href: stay22Href,
      label: "Check nearby stays",
      dataCta: "check_nearby",
      rel: "noopener nofollow sponsored",
    };
  }
  return {
    mode: "stay22",
    href: stay22Href,
    label: "Check availability",
    dataCta: "check_availability",
    rel: "noopener nofollow sponsored",
  };
}

// ── Verified-wrong CTA gate ──────────────────────────────────────────────────────────────────────
// Minimal shape we need from the Supabase client — accepts the real client or a test double, same
// contract as src/lib/delisted.ts's DbLike.
type DbLike = Pick<SupabaseClient, "from">;

/** Verdicts a real-browser sweep of Stay22's "Check availability" link can assign. Only these three
 *  count as VERIFIED WRONG for the CTA swap; EXACT/SELECTED are a confirmed-good landing, and
 *  PENDING/absent means "not checked yet" — both must render the untouched default CTA. */
const STAY22_WRONG_VERDICTS = new Set(["WRONG_PROPERTY", "CITY_SEARCH", "UNMATCHED_SEARCH"]);

let wrongSlugCache: { at: number; slugs: Set<string> } = { at: 0, slugs: new Set() };
const WRONG_CACHE_MS = 10 * 60 * 1000;

/**
 * Slugs whose Stay22 landing has been VERIFIED wrong by the real-browser sweep (data captured in
 * die-validation's data/stay22-verdicts.json, imported into the `stay22_checks` table by
 * scripts/import-stay22-verdicts.mjs — see sql/stay22-checks.sql). Cached ~10 minutes per server
 * process, mirroring src/lib/delisted.ts getDelistedSlugSet.
 *
 * FAIL-SAFE: the `stay22_checks` table not existing yet (pre-migration), or any other query error,
 * returns an EMPTY set — never a stale or partial one — so a missing/broken table can only ever
 * cause every hotel to render its pre-existing DEFAULT CTA. It must never be able to suppress a
 * Stay22 button that earns affiliate revenue today.
 *
 * `ttlMs` defaults to the 10-minute cache window; tests pass 0 to force a fresh fetch every call.
 */
export async function getStay22WrongSlugs(db?: DbLike | null, ttlMs: number = WRONG_CACHE_MS): Promise<Set<string>> {
  if (!db) return wrongSlugCache.slugs;
  const now = Date.now();
  // ttlMs <= 0 (tests only) always bypasses the cache read below; production callers never pass 0.
  if (ttlMs > 0 && now - wrongSlugCache.at < ttlMs) return wrongSlugCache.slugs;
  try {
    const { data, error } = await db.from("stay22_checks").select("slug, verdict");
    if (error) {
      wrongSlugCache = { at: now, slugs: new Set() }; // table missing/broken — fail to empty, not stale
      return wrongSlugCache.slugs;
    }
    const slugs = new Set(
      ((data || []) as Array<{ slug: string | null; verdict: string | null }>)
        .filter((r) => STAY22_WRONG_VERDICTS.has(String(r.verdict || "")))
        .map((r) => String(r.slug || ""))
        .filter(Boolean),
    );
    wrongSlugCache = { at: now, slugs };
    return slugs;
  } catch {
    wrongSlugCache = { at: now, slugs: new Set() };
    return wrongSlugCache.slugs;
  }
}

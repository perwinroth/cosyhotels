// Shared badge-outreach pitch + contact-link builders. Used by BOTH the /growth/badges board and the
// /growth Today daily plan, so they always send the SAME personalized pitch and one-click Gmail link.
import { cityToSlug } from "@/lib/citySlug";

export const BADGE_SUBJECT = "You made the Cosy Index: here's your badge";
// The ONLY account whose default send-as is per@gotcosy.com (Zoho SMTP relay). perwinroth@gmail.com
// has no such default — pointing compose links there sent all badge outreach from the bare personal
// address (incident 2026-07-09). Never change this without verifying the send-as in Gmail settings.
const GMAIL_ACCOUNT = "gotcosy@gmail.com";

// A clean, unique excerpt of the hotel's own cosy write-up (trims to a sentence boundary near `max`),
// so every pitch quotes something different: better deliverability AND reply rate.
export function pitchExcerpt(desc: string | null | undefined, max = 450): string {
  const clean = String(desc || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const end = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (end > 140) return slice.slice(0, end + 1);
  const space = slice.lastIndexOf(" ");
  return `${slice.slice(0, space > 0 ? space : max).trim()}…`;
}

// The personalized badge pitch: quotes THIS hotel's cosy write-up so no two emails are identical.
export function buildBadgePitch(
  h: { name: string; score: number; slug: string; city: string; description?: string | null },
  opts: { totalTxt: string; base: string },
): string {
  const badgeLink = `${opts.base}/en/hotels/${h.slug}?badge`;
  const cityLink = `${opts.base}/en/guides/${cityToSlug(h.city || "")}`;
  const excerpt = pitchExcerpt(h.description);
  const personal = excerpt ? `Here's what earned it, in our own words:\n"${excerpt}"\n\n` : "";
  return `Hi! 👋 ${h.name} just made our Cosy Index: the cosiest ~2.3% of the ${opts.totalTxt} hotels we've AI-scored, with a ${h.score.toFixed(1)}/10 Cosy Score for warmth & character.\n\n${personal}Grab your "Rated Cosy" badge to show it off; it links back to your ranking: ${badgeLink}\n\nYou're featured here: ${cityLink}\n\nA link back would mean a lot 🔥\nGot Cosy (gotcosy.com)`;
}

// One-click Gmail compose deep-link (opens gotcosy@gmail.com with a pre-filled, editable draft; nothing
// auto-sends; the from-address is that account's default send-as, per@gotcosy.com).
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  // Account goes in the PATH (u/<email>), never authuser + u/0: that pair contradicts itself and
  // Gmail errors once, then silently falls back to the browser's default account (2026-07-09).
  p.set("authuser", GMAIL_ACCOUNT);
  return `https://mail.google.com/mail/?${p.toString()}`;
}

// Instagram DM deep-link (DMs can't be pre-filled; Per pastes the copied pitch).
export function instagramDmUrl(handle: string): string {
  const h = handle.replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]+$/.test(h) ? `https://ig.me/m/${h}` : `https://instagram.com/${encodeURIComponent(h)}`;
}

// ----- Variant experiment (pre-registered: die-validation outreach-experiment-preregistration-2026-07-07) -----
// Deterministic arm assignment; MUST match die-validation/scripts/measure-outreach.mjs exactly.
import { createHash } from "node:crypto";
export type PitchVariant = "v2" | "v3";
export function variantFor(hotelId: string): PitchVariant {
  return parseInt(createHash("sha1").update(String(hotelId)).digest("hex").slice(0, 8), 16) % 2 === 0 ? "v2" : "v3";
}

// Challenger-approved texts (edits applied verbatim). Honesty clauses: excerpt always disclosed as
// condensed-from-reviews; "top 2.3% of them"; opt-out line mandatory; no tracking pixels.
export function buildVariantPitch(
  variant: PitchVariant,
  h: { name: string; score: number; slug: string; city: string; description?: string | null },
  opts: { base: string },
): { subject: string; body: string } {
  const hotelPage = `${opts.base}/en/hotels/${h.slug}`;
  const badgeLink = `${hotelPage}?badge`;
  const excerpt = pitchExcerpt(h.description, 300);
  const optOut = `If you'd rather not hear from us, just reply "no thanks".`;
  if (variant === "v2") {
    return {
      subject: `Your guests made ${h.name} one of the cosiest hotels in ${h.city}`,
      body: `Hi,

I run GotCosy, a small hotel-discovery site. We analyse the guest reviews of 17,727 hotels for warmth and character, and ${h.name} came out in the top 2.3% of them, with a cosy score of ${h.score.toFixed(1)}/10.

${excerpt ? `What earned it is what your own guests keep saying; this line is condensed from their reviews: "${excerpt}"

` : ""}Your page, with the score and the reasons behind it: ${hotelPage}

We mainly wanted whoever creates that warmth to know how clearly it shows. If you'd like a small "Rated Cosy" badge for your website, it's free: ${badgeLink}

${optOut}

Per
gotcosy.com`,
    };
  }
  return {
    subject: `The data on ${h.name}: top 2.3% of 17,727 hotels for cosiness`,
    body: `Hi,

We've just published a guest-review-language analysis of 17,727 hotels: how warmly guests actually write about where they stayed. The methodology and full tables are public: https://gotcosy.com/en/data/cosiest-hotel-towns?utm_source=outreach&utm_campaign=v3

${h.name} scored ${h.score.toFixed(1)}/10: the top 2.3% of them.${excerpt ? ` The evidence (this line is condensed from your guests' reviews): "${excerpt}"` : ""}

Your full evidence page: ${hotelPage}

A free "Rated Cosy" badge is available for your site if useful: ${badgeLink}. Happy to answer anything about how the score works.

${optOut}

Per
gotcosy.com`,
  };
}

// ----- Instagram badge wave (Challenger-passed 2026-07-11) -----
// House style note: the email variants above use commas/colons, never em dashes, so the approved DM
// texts (drafted with em dashes) were normalised to commas/colons per the Challenger's own exception
// rule ("keep em dashes ONLY if the email variants use them" — they don't).

// Percentile rounding for every "top {PCT}%" claim: ALWAYS round UP, so the claim can only ever
// understate the hotel's standing (5.7 → "top 6%", never "top 5%"). Pure + exported for tests.
export function roundPctUp(rawPct: number): number {
  return Math.ceil(rawPct);
}

// The badge-tier ladder. The percent LABELS here are fixed copy, computed from live score_final
// counts on 2026-07-11 and rounded up; they are NOT recomputed. The per-hotel "{PCT}%" used in DMs
// is a different number: computed per hotel (stamped by scripts/seed-ig-outreach.mjs).
export type BadgeTier = { key: "index" | "top16" | "top27"; label: string };
export function tierForScore(score: number): BadgeTier | null {
  if (score >= 7.0) return { key: "index", label: "Cosy Index" };
  if (score >= 6.5) return { key: "top16", label: "Rated Cosy · Top 16%" };
  if (score >= 6.0) return { key: "top27", label: "Rated Cosy · Top 27%" };
  return null; // below the proactive-outreach floor: no tier, no graphic
}

// Challenger-approved DM texts for the IG wave. Contract (tested in tests/ig-wave.test.ts):
// exactly ONE http link (the asset page), the opt-out sentence always present, and the evidence
// phrase NEVER wrapped in quote marks. score/pct/total must come STAMPED from the outreach row
// (frozen at queue time by the seeder) — callers must not recompute them live (drift risk).
export function buildVariantDm(
  variant: PitchVariant,
  opts: { name: string; score: number; pct: number; evidence: string; assetLink: string; total?: number },
): string {
  const totalTxt = (opts.total ?? 17727).toLocaleString("en-GB");
  const score = opts.score.toFixed(1);
  // Trim trailing sentence punctuation from the condensed evidence so the template's own full stop
  // never doubles up ("…blankets.." / "…blankets….").
  const ev = String(opts.evidence || "").trim().replace(/[.…\s]+$/, "");
  const optOut = `If you'd rather not hear from us, just reply "no thanks" and we won't write again.`;
  // Blank-line paragraph breaks (\n\n): pasted into an Instagram DM the single-blurb version read as
  // a wall of text (founder, 2026-07-15). Wording is byte-identical to the approved copy; only spacing
  // changed (and the full stop after the asset URL dropped so IG keeps the link clickable).
  if (variant === "v2") {
    const evidence = ev ? `What guests keep mentioning, condensed from their reviews: ${ev}.\n\n` : "";
    return `${opts.name} scored ${score}/10 for cosiness: top ${opts.pct}% of the ${totalTxt} hotels we've analysed from guest reviews.\n\n${evidence}We made you a free ready-to-post graphic with it, nothing to buy, nothing asked: ${opts.assetLink}\n\nI'm Per, I run Got Cosy. ${optOut}`;
  }
  return `${opts.name} scored ${score}/10 for cosiness in our review-language analysis of ${totalTxt} hotels: top ${opts.pct}% of them.\n\nThe method is public, and this page has the evidence from your own guests plus a free ready-to-post graphic: ${opts.assetLink}\n\nHappy to answer anything about how the score works. ${optOut}`;
}

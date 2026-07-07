// Shared badge-outreach pitch + contact-link builders. Used by BOTH the /growth/badges board and the
// /growth Today daily plan, so they always send the SAME personalized pitch and one-click Gmail link.
import { cityToSlug } from "@/lib/citySlug";

export const BADGE_SUBJECT = "You made the Cosy Index — here's your badge";
const GMAIL_ACCOUNT = "gotcosy@gmail.com";

// A clean, unique excerpt of the hotel's own cosy write-up (trims to a sentence boundary near `max`),
// so every pitch quotes something different — better deliverability AND reply rate.
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

// The personalized badge pitch — quotes THIS hotel's cosy write-up so no two emails are identical.
export function buildBadgePitch(
  h: { name: string; score: number; slug: string; city: string; description?: string | null },
  opts: { totalTxt: string; base: string },
): string {
  const badgeLink = `${opts.base}/en/hotels/${h.slug}?badge`;
  const cityLink = `${opts.base}/en/guides/${cityToSlug(h.city || "")}`;
  const excerpt = pitchExcerpt(h.description);
  const personal = excerpt ? `Here's what earned it, in our own words:\n"${excerpt}"\n\n` : "";
  return `Hi! 👋 ${h.name} just made our Cosy Index — the cosiest ~2.3% of the ${opts.totalTxt} hotels we've AI-scored, with a ${h.score.toFixed(1)}/10 Cosy Score for warmth & character.\n\n${personal}Grab your "Rated Cosy" badge to show it off — it links back to your ranking: ${badgeLink}\n\nYou're featured here: ${cityLink}\n\nA link back would mean a lot 🔥\n— Got Cosy (gotcosy.com)`;
}

// One-click Gmail compose deep-link (opens gotcosy@gmail.com with a pre-filled, editable draft — nothing
// auto-sends; the from-address is that account's default send-as, per@gotcosy.com).
export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const p = new URLSearchParams({ authuser: GMAIL_ACCOUNT, view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/u/0/?${p.toString()}`;
}

// Instagram DM deep-link (DMs can't be pre-filled — Per pastes the copied pitch).
export function instagramDmUrl(handle: string): string {
  const h = handle.replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]+$/.test(h) ? `https://ig.me/m/${h}` : `https://instagram.com/${encodeURIComponent(h)}`;
}

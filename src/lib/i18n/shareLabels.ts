// Shared translated-label builder for ShareButton, mirroring saveLabels.ts (buildSaveLabels): every
// page that mounts ShareButton builds its labels through this one helper so the copy set stays
// identical everywhere and is translated once per page render. Brand names (WhatsApp, Facebook,
// Messenger, Instagram) are NOT included here — they stay hardcoded in ShareButton.tsx itself,
// matching the site-wide rule that brand/proper nouns are never translated.
import { translate } from "@/lib/i18n/translate";
import type { ShareLabels } from "@/components/ShareButton";

const KEYS = [
  "Share",
  "Copy link",
  "Copied!",
  "Email",
  "Pin it",
  "Copied. Paste in Instagram",
  "Thought you'd like this cosy hotel:",
  "Shared from Got Cosy",
] as const;

export async function buildShareLabels(locale: string): Promise<ShareLabels> {
  const tx = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const [toggle, copyLink, copied, email, pinIt, instagramCopied, emailIntro, emailFooter] = await Promise.all(KEYS.map(tx));
  return { toggle, copyLink, copied, email, pinIt, instagramCopied, emailIntro, emailFooter };
}

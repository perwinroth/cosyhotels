// Shared translated-label builder for SaveToTripButton (saved lists). Every page that renders the
// button (hotel detail "block", or "compact" on a listing card) builds its labels through this one
// helper so the copy set (including the compact "saveShort" text) stays identical everywhere and is
// only translated once per page render, per the standing rule that all UI chrome strings route
// through translate()/tx before reaching a client component.
import { translate } from "@/lib/i18n/translate";
import type { SaveToTripLabels } from "@/components/SaveToTripButton";

const KEYS = [
  "Save to your plan",
  "Add to plan",
  "Added to your plan",
  "Save this hotel to a plan",
  "Your email",
  "you@example.com",
  "We use your email only to create your private edit link for this plan. It is never shown publicly, and you can ask us to revoke the link at any time.",
  "Name your plan (optional)",
  "e.g. Our Tuscany trip",
  "Save",
  "Cancel",
  "Copy link",
  "Copied",
  "View your plan",
  "Save this link. It is the only way to edit your plan later.",
  "Enter a valid email and agree to continue.",
  "Something went wrong. Please try again.",
] as const;

export async function buildSaveLabels(locale: string): Promise<SaveToTripLabels> {
  const tx = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const [
    save, saveShort, added, emailPrompt, emailLabel, emailPlaceholder, consent,
    titleLabel, titlePlaceholder, submit, cancel, copyLink, copied,
    viewPlan, yourPrivateLink, emailInvalid, genericError,
  ] = await Promise.all(KEYS.map(tx));
  return {
    save, saveShort, added, emailPrompt, emailLabel, emailPlaceholder, consent,
    titleLabel, titlePlaceholder, submit, cancel, copyLink, copied,
    viewPlan, yourPrivateLink, emailInvalid, genericError,
  };
}

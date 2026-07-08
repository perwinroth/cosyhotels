"use server";
// Server action for /growth/pr: create a real Gmail draft (From per@gotcosy.com) for one PR pitch,
// using the Challenger-approved subject and body stored in src/data/prActions.ts. Same gmail lib and
// trust boundary as the data-brief and journo boards (middleware panel-cookie gate on /growth/*).
// Only usable for pitches with a verified direct email; form routes stay copy-paste, and HOLD
// pitches (Byway) refuse until the hold lifts.
import { createGmailDraft } from "@/lib/gmail";
import { PR_ACTIONS } from "@/data/prActions";

export async function createPrDraft(id: string): Promise<{ link?: string; error?: string }> {
  const action = PR_ACTIONS[id];
  const pitch = action?.pitch;
  if (!pitch) return { error: "no stored pitch for this row" };
  if (pitch.hold) return { error: `on hold: ${pitch.hold}` };
  if (!pitch.to) return { error: "no verified email; use the listed route and the copy buttons" };
  const created = await createGmailDraft({ to: pitch.to, subject: pitch.subject, body: pitch.body });
  if (!created) return { error: "Gmail draft failed: check GMAIL_* env or per@gotcosy.com Send-As setup" };
  return { link: created.link };
}

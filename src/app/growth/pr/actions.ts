"use server";
// Server action for /growth/pr: create a real Gmail draft (From per@gotcosy.com) for one PR pitch,
// using the Challenger-approved subject and body stored in src/data/prActions.ts. Same gmail lib and
// trust boundary as the data-brief and journo boards (middleware panel-cookie gate on /growth/*).
// Only usable for pitches with a verified direct email; form routes stay copy-paste, and HOLD
// pitches (Byway) refuse until the hold lifts.
import { createGmailDraftResult, type GmailDraftResult } from "@/lib/gmail";
import { PR_ACTIONS } from "@/data/prActions";

// `reason`/`detail` come straight from createGmailDraftResult so the board can show a SPECIFIC cause
// (missing email vs bad token vs Gmail rejection) instead of one generic message. `error` still covers
// the pre-flight guards below (no pitch / on hold / no address).
type DraftFailReason = Extract<GmailDraftResult, { ok: false }>["reason"];
export async function createPrDraft(id: string): Promise<{ link?: string; error?: string; reason?: DraftFailReason; detail?: string }> {
  const action = PR_ACTIONS[id];
  const pitch = action?.pitch;
  if (!pitch) return { error: "no stored pitch for this row" };
  if (pitch.hold) return { error: `on hold: ${pitch.hold}` };
  if (!pitch.to) return { error: "no verified email; use the listed route and the copy buttons" };
  const r = await createGmailDraftResult({ to: pitch.to, subject: pitch.subject, body: pitch.body });
  if (!r.ok) return { reason: r.reason, detail: r.detail };
  return { link: r.link };
}

"use server";
// Server action for /growth/data-brief: create a real Gmail draft (from per@gotcosy.com) for one
// campaign target, using the same personalized body the board already renders. Only usable for
// targets with a verified email — everyone else stays on their listed contact route (DM/contact
// form), which this board doesn't automate.
import { createGmailDraft } from "@/lib/gmail";
import { CAMPAIGN, TARGETS } from "@/data/dataBriefCampaign";

function buildBody(first: string, personal: string): string {
  return CAMPAIGN.bodyTemplate.replace("{FIRST}", first).replace("{PERSONAL}", personal);
}

export async function createBriefDraft(rank: number): Promise<{ link?: string; error?: string }> {
  const target = TARGETS.find((t) => t.rank === rank);
  if (!target) return { error: "unknown target" };
  if (!target.email) return { error: "no verified email for this target" };
  const body = buildBody(target.first, target.personal);
  const created = await createGmailDraft({ to: target.email, subject: CAMPAIGN.subject, body });
  if (!created) return { error: "Gmail draft failed: check GMAIL_* env or per@gotcosy.com Send-As setup" };
  return { link: created.link };
}

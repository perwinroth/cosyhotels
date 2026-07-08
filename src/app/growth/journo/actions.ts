"use server";
// Server actions for the /growth/journo board: advance a journo_queries row's status, and the
// one-click "Draft with AI → Gmail" action. Writes with the service-role key (same trust boundary
// as /api/admin/outreach — this route tree is already gated by middleware's panel-cookie check on
// /growth/*).
import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabase/server";
import { createGmailDraft } from "@/lib/gmail";
import { draftReply, subjectFor } from "@/lib/journoReply";

const ALLOWED = ["new", "drafted", "skipped", "sent", "expired"];

export async function updateJournoStatus(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  if (!id || !ALLOWED.includes(status)) return { ok: false, error: "bad request" };
  const db = getServerSupabase();
  if (!db) return { ok: false, error: "db not configured" };
  const { error } = await db.from("journo_queries").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/growth/journo");
  return { ok: true };
}

// Generates the grounded reply (same source library + prompt as the cron — src/lib/journoReply.ts),
// creates the Gmail draft, and marks the row "drafted". Deliberately works for ANY row that has a
// reply_to, regardless of fit_score — the cron only auto-drafts fit >= 0.6, but Per should be able
// to force-draft a low-fit query he still wants to answer personally.
export async function draftAndOpen(id: string): Promise<{ ok: boolean; link?: string; error?: string }> {
  if (!id) return { ok: false, error: "bad request" };
  const db = getServerSupabase();
  if (!db) return { ok: false, error: "db not configured" };

  const { data: row, error: fetchErr } = await db
    .from("journo_queries")
    .select("id,source,outlet,deadline,category,query_text,reply_to")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!row) return { ok: false, error: "row not found" };
  if (!row.reply_to) return { ok: false, error: "no reply address found in the digest for this query" };

  const body = await draftReply(row);
  if (!body) return { ok: false, error: "reply generation failed: check ANTHROPIC_API_KEY" };

  const created = await createGmailDraft({ to: row.reply_to, subject: subjectFor(row), body });
  if (!created) return { ok: false, error: "Gmail draft failed: check GMAIL_* env / per@gotcosy.com Send-As" };

  const { error: updateErr } = await db
    .from("journo_queries")
    .update({ status: "drafted", draft_id: created.id, draft_link: created.link })
    .eq("id", id);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/growth/journo");
  return { ok: true, link: created.link };
}

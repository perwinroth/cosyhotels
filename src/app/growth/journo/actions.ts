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

// Add a DIRECT request (a Substack call, a DM, a forwarded email) that never came through the digest
// cron. Inserts a journo_queries row so it lands on the board; Per then uses the existing "Draft with
// AI" button on its card (which needs reply_to). Same trust boundary as the other actions (panel-gated).
export async function addDirectRequest(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const journalist = String(formData.get("journalist") || "").trim();
  const query_text = String(formData.get("query_text") || "").trim();
  const outlet = String(formData.get("outlet") || "").trim() || null;
  const reply_to = String(formData.get("reply_to") || "").trim() || null;
  if (!journalist || !query_text) return { ok: false, error: "journalist name and request text are required" };
  const db = getServerSupabase();
  if (!db) return { ok: false, error: "db not configured" };
  const slug = journalist.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "direct";
  const id = `direct-${slug}-${Date.now()}`;
  const { error } = await db.from("journo_queries").insert({
    id, source: outlet || "Direct", received_at: new Date().toISOString(),
    outlet, journalist, category: null, query_text,
    fit_score: null, fit_reason: "Added directly by Per (not from a digest).", status: "new", reply_to,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/growth/journo");
  return { ok: true };
}

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

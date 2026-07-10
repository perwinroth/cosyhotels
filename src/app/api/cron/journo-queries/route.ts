// Inbound journalist-query triage (die/journo-queries). Runs 3x/day, reads Source of Sources /
// HARO / Featured digests from the mailbox GMAIL_REFRESH_TOKEN is authorized for (see ACCOUNT in
// lib/gmail.ts — Per sends from per@gotcosy.com Send-As on that account, so digests land there
// directly, no forwarding needed), parses each digest into individual queries, triages GotCosy's
// fit with Haiku, and drafts a grounded reply with Sonnet for the good-fit ones — landing in that
// account's Gmail Drafts (From per@gotcosy.com) for Per to review, edit and send (never auto-sent).
// Surfaced in /growth/journo.
//
// Vercel invokes this with the CRON_SECRET Bearer; middleware fail-closed-gates /api/cron/*, and we
// re-check here too.
//
// DEPENDENCY: reading the inbox needs the gmail.readonly scope (same as outreach-sync). Until Per
// re-runs scripts/gmail-auth.mjs and replaces GMAIL_REFRESH_TOKEN, gmail.ts throws GmailScopeError
// and this cron returns a graceful 200 {ok:false, error:"…needs readonly scope…"}.
//
// Query params:
//   ?dry=1   search + parse + triage (Haiku only — cheap), but skip Sonnet drafting, Gmail draft
//            creation and ALL DB writes. Returns what it WOULD do.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getServerSupabase } from "@/lib/supabase/server";
import { getDigestAccessToken, searchMessageIds, getMessagePlainText, createGmailDraft, GmailScopeError } from "@/lib/gmail";
import { parseDigest, sourceFromEmail, type ParsedQuery } from "@/lib/journoDigest";
import { draftReply as sharedDraftReply, subjectFor, getAnthropicClient } from "@/lib/journoReply";

type Query = ParsedQuery & { receivedAt: string | null };

export const runtime = "nodejs";
export const maxDuration = 300;

const HAIKU = "claude-haiku-4-5";

// Quota/cost safety: cap how much of a single run goes to the LLM.
const MAX_MESSAGES = 15; // digest emails fetched per run
const MAX_TRIAGE = 20;   // queries triaged (Haiku) per run
const MAX_DRAFTS = 8;    // replies drafted (Sonnet + Gmail draft) per run

// Below this triage fit the query lands as status "skipped" (not "new") so junk never reaches the
// founder's actionable board section. Only applied when triage actually succeeded: a triage
// failure keeps status "new" so a real query is never buried by an LLM hiccup. Auto-skipped rows
// stay recoverable in the board's collapsed Auto-skipped section.
const MIN_FIT = 0.35;

// Sender-domain match first; subject fallbacks catch digests forwarded/relayed through a different
// domain, or a sender name Gmail doesn't resolve to the domain we expect.
const SEARCH_Q =
  '(from:sourceofsources.com OR from:helpareporter.com OR from:helpareporter.net OR from:sourcebottle.com OR from:thesourcebottle.com OR from:featured.com OR from:connectively.us ' +
  'OR subject:"Source of Sources" OR subject:"SOS Daily" OR subject:"Featured question" OR subject:"Featured questions") ' +
  "newer_than:2d";

// draftReply + SOURCE_LIBRARY + subjectFor now live in src/lib/journoReply.ts, shared with the
// /growth/journo board's manual "Draft with AI" action so both paths produce an identical reply.
const draftReply = sharedDraftReply;

const TRIAGE_SYSTEM = `You triage inbound journalist source-requests for GotCosy, a small hotel-discovery site that scores hotels for cosiness from guest reviews (17,727 hotels, 164 cities). The ONLY question that matters: could a reply built on GotCosy's COSINESS data (warmth, character, intimacy, quiet, independents-vs-chains, small towns vs capitals) credibly add value for THIS journalist? Merely involving hotels or accommodation is NOT fit. Explicitly LOW fit (<=0.3): event/sports/conference lodging logistics (marathons, festivals, group blocks), points/rewards/credit cards, budget/deals roundups, business-travel logistics, spa/beauty/wellness TREATMENTS and products (even at hotels: we score stays, not treatments or skincare), venue sourcing for weddings/shoots, anything where the angle is availability/price/location rather than how a stay FEELS. HIGH fit (>=0.6) only when the query seeks: cosy/charming/boutique/quiet/characterful stays, what makes hotels feel a certain way, independents vs chains, small-town/destination character, or hotel data/statistics on guest experience. Score fit_score 0-1; reserve >0.85 for near-exact matches. fit_reason MUST name the specific GotCosy angle that fits (or the concrete mismatch if low) in one sentence a busy founder can act on instantly - never restate the query. Also give a short category label (e.g. "boutique hotels", "travel data", "event logistics - no fit").`;

const TRIAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fit_score: { type: "number", description: "0 (no fit) to 1 (perfect fit) for whether GotCosy can credibly contribute." },
    fit_reason: { type: "string", description: "One concise sentence explaining the score." },
    category: { type: "string", description: "A short category label for the query." },
  },
  required: ["fit_score", "fit_reason", "category"],
} as const;

async function triage(q: Query): Promise<{ fit_score: number; fit_reason: string; category: string } | null> {
  const client = getAnthropicClient();
  if (!client) return null;
  try {
    const resp = await client.messages.create({
      model: HAIKU,
      max_tokens: 300,
      temperature: 0,
      thinking: { type: "disabled" },
      system: [{ type: "text", text: TRIAGE_SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { format: { type: "json_schema", schema: TRIAGE_SCHEMA } },
      messages: [{ role: "user", content: `OUTLET: ${q.outlet || "unknown"}\nCATEGORY (as given, may be wrong): ${q.category || "none"}\nQUERY:\n${q.query_text}` }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (resp.stop_reason === "refusal") return null;
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return null;
    const parsed = JSON.parse(textBlock.text) as { fit_score?: number; fit_reason?: string; category?: string };
    if (typeof parsed.fit_score !== "number") return null;
    return { fit_score: Math.max(0, Math.min(1, parsed.fit_score)), fit_reason: parsed.fit_reason || "", category: parsed.category || q.category || "uncategorized" };
  } catch {
    return null;
  }
}

// Best-effort Telegram ping (same pattern/channel as reddit-scan / outreach-sync). No-op when env
// unset; never throws.
async function pushTelegram(text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ from: "journo-queries", ok: false, error: "Supabase not configured" }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ from: "journo-queries", ok: false, error: "ANTHROPIC_API_KEY not set — add it to Vercel env." });
  }

  // Refresh the DIGEST-mailbox access token up front (HARO/SOS digests arrive at
  // perwinroth@gmail.com — the READ mailbox; drafts are created separately via the main token in
  // the SEND mailbox, gotcosy@gmail.com). A missing-env or insufficient-scope failure returns a
  // graceful 200 so a broken/unconfigured token never crashes the cron.
  let accessToken: string;
  try {
    accessToken = await getDigestAccessToken();
  } catch (e) {
    const scopeHint = "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs (as perwinroth@gmail.com) and update GMAIL_DIGEST_REFRESH_TOKEN";
    return NextResponse.json({
      from: "journo-queries",
      ok: false,
      error: e instanceof GmailScopeError ? scopeHint : `${scopeHint} (${String(e instanceof Error ? e.message : e)})`,
    });
  }

  let messageIds: string[];
  try {
    messageIds = await searchMessageIds(SEARCH_Q, accessToken, MAX_MESSAGES);
  } catch (e) {
    if (e instanceof GmailScopeError) {
      return NextResponse.json({ from: "journo-queries", ok: false, error: "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN" });
    }
    return NextResponse.json({ from: "journo-queries", ok: false, error: String(e instanceof Error ? e.message : e) }, { status: 502 });
  }

  // Fetch + parse every digest message into individual queries.
  const parsed: Query[] = [];
  for (const id of messageIds) {
    let msg;
    try {
      msg = await getMessagePlainText(id, accessToken);
    } catch (e) {
      if (e instanceof GmailScopeError) {
        return NextResponse.json({ from: "journo-queries", ok: false, error: "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN" });
      }
      continue; // one bad message shouldn't kill the whole run
    }
    if (!msg) continue;
    const source = sourceFromEmail(msg.from);
    const d = new Date(msg.date);
    const receivedAt = Number.isNaN(d.getTime()) ? null : d.toISOString();
    for (const q of parseDigest(msg.text, source)) parsed.push({ ...q, receivedAt });
  }

  // De-dup against what's already in the table.
  let existingIds = new Set<string>();
  if (parsed.length) {
    const { data: existing, error } = await db.from("journo_queries").select("id").in("id", parsed.map((q) => q.id));
    if (error) return NextResponse.json({ from: "journo-queries", ok: false, error: error.message }, { status: 500 });
    existingIds = new Set((existing || []).map((r) => (r as { id: string }).id));
  }
  const fresh = parsed.filter((q) => !existingIds.has(q.id));
  const capped = fresh.length > MAX_TRIAGE;
  const batch = fresh.slice(0, MAX_TRIAGE);

  type Row = {
    id: string; source: string; received_at: string | null; outlet: string | null; journalist: string | null;
    deadline: string | null; category: string | null; query_text: string; fit_score: number | null;
    fit_reason: string | null; status: string; draft_id: string | null; draft_link: string | null; reply_to: string | null;
  };
  const rows: Row[] = [];
  const dryPreview: Array<{ outlet: string | null; deadline: string | null; category: string; fit_score: number; would_draft: boolean; query: string }> = [];
  let drafted = 0;
  let notified = false;
  let notifiedManual = false;
  const notifyLines: string[] = [];
  // Good-fit queries with NO reply address: nothing can be auto-drafted, so the founder must act
  // manually; these get their own Telegram ping below.
  const manualLines: string[] = [];

  for (const q of batch) {
    const t = await triage(q);
    const fitScore = t?.fit_score ?? 0;
    const fitReason = t?.fit_reason ?? "triage failed: reviewed manually";
    const category = t?.category ?? q.category ?? "uncategorized";
    // Respect journalists' explicit "No AI Pitches" flags: never auto-draft those — the query still
    // lands on the /growth/journo board for Per to answer personally (integrity + pitch survival).
    const noAiPitch = /no\s+ai[\s-]*(pitch|generated|written|content)/i.test(q.query_text) || /no\s+ai\s+pitch/i.test(q.deadline || "");
    const wouldDraft = fitScore >= 0.6 && Boolean(q.reply_to) && !noAiPitch;

    if (dry) {
      dryPreview.push({ outlet: q.outlet, deadline: q.deadline, category, fit_score: fitScore, would_draft: wouldDraft, query: q.query_text.slice(0, 200) });
      continue;
    }

    // Triage-gated landing status: confidently-low-fit queries go straight to "skipped" so they
    // never appear in the founder's actionable section (recoverable via the board's Auto-skipped
    // details). Triage failures (t == null) stay "new"; never bury a query on an LLM error.
    let status = t && fitScore < MIN_FIT ? "skipped" : "new";
    const reasonOut = noAiPitch && fitScore >= 0.6 ? `${fitReason}; NO-AI-PITCH flag: answer personally` : fitReason;
    if (fitScore >= 0.6 && !q.reply_to) {
      manualLines.push(`• ${q.outlet || category}: ${q.deadline ? `deadline ${q.deadline} · ` : ""}${q.query_text.slice(0, 80)}`);
    }
    let draftId: string | null = null;
    let draftLink: string | null = null;
    if (wouldDraft && drafted < MAX_DRAFTS) {
      const body = await draftReply(q);
      if (body) {
        const created = await createGmailDraft({ to: q.reply_to!, subject: subjectFor(q), body });
        if (created) {
          status = "drafted";
          draftId = created.id;
          draftLink = created.link;
          drafted++;
          notifyLines.push(`• ${q.outlet || category}: ${q.deadline ? `deadline ${q.deadline} · ` : ""}${q.query_text.slice(0, 80)}\n  ${created.link}`);
        }
      }
    }

    rows.push({
      id: q.id, source: q.source, received_at: q.receivedAt, outlet: q.outlet, journalist: q.journalist,
      deadline: q.deadline, category, query_text: q.query_text, fit_score: fitScore, fit_reason: reasonOut,
      status, draft_id: draftId, draft_link: draftLink, reply_to: q.reply_to,
    });
  }

  if (dry) {
    return NextResponse.json({
      from: "journo-queries", dry: true, ok: true,
      messagesFound: messageIds.length, blocksParsed: parsed.length, newQueries: fresh.length, capped,
      preview: dryPreview,
    });
  }

  if (rows.length) {
    const { error } = await db.from("journo_queries").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ from: "journo-queries", ok: false, error: error.message }, { status: 500 });
  }

  if (notifyLines.length) {
    notified = await pushTelegram(
      `${notifyLines.length} journo-query repl${notifyLines.length > 1 ? "ies" : "y"} drafted:\n${notifyLines.join("\n")}\n\nReview → https://gotcosy.com/growth/journo`,
    );
  }

  // Good fit but no reply address in the digest: no Gmail draft could be created, so the founder
  // must act manually. Separate ping so these never hide behind the drafted ones.
  if (manualLines.length) {
    notifiedManual = await pushTelegram(
      `${manualLines.length} good-fit journo quer${manualLines.length > 1 ? "ies" : "y"} need${manualLines.length > 1 ? "" : "s"} you (no reply address found):\n${manualLines.join("\n")}\n\nDraft ready on the board → https://gotcosy.com/growth/journo`,
    );
  }

  return NextResponse.json({
    from: "journo-queries", ok: true, dry: false,
    messagesFound: messageIds.length, blocksParsed: parsed.length, newQueries: fresh.length, capped,
    triaged: batch.length, drafted, notified, notifiedManual,
  });
}

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
import { getAccessToken, searchMessageIds, getMessagePlainText, createGmailDraft, GmailScopeError } from "@/lib/gmail";
import { parseDigest, sourceFromEmail, type ParsedQuery } from "@/lib/journoDigest";

type Query = ParsedQuery & { receivedAt: string | null };

export const runtime = "nodejs";
export const maxDuration = 300;

const HAIKU = "claude-haiku-4-5";
const SONNET = "claude-sonnet-4-6";

// Quota/cost safety: cap how much of a single run goes to the LLM.
const MAX_MESSAGES = 15; // digest emails fetched per run
const MAX_TRIAGE = 20;   // queries triaged (Haiku) per run
const MAX_DRAFTS = 8;    // replies drafted (Sonnet + Gmail draft) per run

// Sender-domain match first; subject fallbacks catch digests forwarded/relayed through a different
// domain, or a sender name Gmail doesn't resolve to the domain we expect.
const SEARCH_Q =
  '(from:sourceofsources.com OR from:helpareporter.com OR from:featured.com ' +
  'OR subject:"Source of Sources" OR subject:"SOS Daily" OR subject:"Featured question" OR subject:"Featured questions") ' +
  "newer_than:2d";

// The ONLY facts the draft model is allowed to cite. Hardcoded so a hallucinated stat can never
// reach a journalist — if a claim isn't in here, it doesn't go in the email.
const SOURCE_LIBRARY = `SOURCE LIBRARY (the ONLY facts you may cite — never invent a fact, hotel, or number beyond this list):
- GotCosy analyzed guest-review language across 17,727 hotels; report + methodology + 164-city tiers + free CSVs: https://gotcosy.com/en/data/cosiest-hotel-towns
- Host-gap: in the 10 cosiest towns in the data, 74% of hotels' review evidence mentions a host, owner or family member, vs 26% in 8 large cities.
- Guesthouse-type naming (guesthouse/B&B/pension etc. in the listing name): 31% of hotels in the cosiest towns vs 10% in the large cities.
- "Boutique" appears in review evidence 53 times in the large cities' data vs 3 times in the towns'; big-city boutique hotels average a 6.30 cosy score vs 6.01 for big-city hotels overall.
- Among reviews that mention atmosphere, "quiet" is the single most common theme — 35.6% of 9,437 atmosphere-mentioning reviews.
- The cosy score is near-uncorrelated with generic guest star ratings (r=0.10, n=7,048) — cosiness and overall rating measure different things.
- Founder: Per, runs GotCosy (a small hotel-discovery site that scores hotels for cosiness by reading guest reviews).`;

const DRAFT_RULES = `RULES for the reply you write:
- 100-170 words.
- Answer THEIR question first — do not open with a generic pitch.
- Cite at most 2 stats from the source library above.
- NEVER invent a fact, hotel name, or number that isn't in the source library.
- If you offer specific review-evidence lines, you MUST label them "condensed by our scoring model from review text — not verbatim guest quotes."
- Offer to run a custom data cut for their story (a region, a hotel type, a different comparison).
- Sign off exactly: "Per — gotcosy.com"
- Plain email prose. No subject line, no markdown, no bullet lists unless the query specifically asks for a list.
Reply with ONLY the email body text — nothing else.`;

function buildDraftPrompt(q: Query): string {
  return `You are drafting a reply, AS PER (founder of GotCosy), to a journalist's source request pulled from a PR digest (${q.source}). Write a reply that could credibly help with their story.

${SOURCE_LIBRARY}

${DRAFT_RULES}

THE JOURNALIST'S QUERY${q.outlet ? ` (outlet: ${q.outlet})` : ""}${q.deadline ? ` (deadline: ${q.deadline})` : ""}:
${q.query_text}`;
}

const TRIAGE_SYSTEM = `You triage inbound journalist source-requests for GotCosy, a small hotel-discovery site that scores hotels for cosiness from guest reviews (17,727 hotels, 164 cities). GotCosy can credibly contribute to queries about: hotels/accommodation, travel (especially Europe and small towns), sleep/quiet travel, boutique/design stays, guesthouses/B&Bs and independent hotels, or travel data/statistics/trend pieces. Everything else — unrelated industries, finance, tech, general lifestyle with no travel/hospitality angle — is a low fit. Score fit_score from 0 (no fit) to 1 (perfect fit); most real queries in this niche land 0.5-0.9, reserve >0.85 for a near-exact match. Give one concise sentence explaining the score, and a short category label for the query (e.g. "hotel trends", "boutique hotels", "travel data", "unrelated").`;

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

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  _client = new Anthropic({ apiKey });
  return _client;
}

async function triage(q: Query): Promise<{ fit_score: number; fit_reason: string; category: string } | null> {
  const client = getClient();
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

async function draftReply(q: Query): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const resp = await client.messages.create({
      model: SONNET,
      max_tokens: 500,
      temperature: 0.4,
      messages: [{ role: "user", content: buildDraftPrompt(q) }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    if (resp.stop_reason === "refusal") return null;
    const textBlock = resp.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return textBlock ? textBlock.text.trim() : null;
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

function subjectFor(q: Query): string {
  const base = (q.category ? `${q.category}: ` : "") + q.query_text.replace(/\s+/g, " ").trim();
  return `Re: ${base.slice(0, 90)}`;
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

  // Refresh the Gmail access token up front. A missing-env or insufficient-scope failure returns a
  // graceful 200 so a broken/unconfigured token never crashes the cron.
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    const scopeHint = "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN";
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
  const notifyLines: string[] = [];

  for (const q of batch) {
    const t = await triage(q);
    const fitScore = t?.fit_score ?? 0;
    const fitReason = t?.fit_reason ?? "triage failed — reviewed manually";
    const category = t?.category ?? q.category ?? "uncategorized";
    const wouldDraft = fitScore >= 0.6 && Boolean(q.reply_to);

    if (dry) {
      dryPreview.push({ outlet: q.outlet, deadline: q.deadline, category, fit_score: fitScore, would_draft: wouldDraft, query: q.query_text.slice(0, 200) });
      continue;
    }

    let status = "new";
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
          notifyLines.push(`• ${q.outlet || category} — ${q.deadline ? `deadline ${q.deadline} — ` : ""}${q.query_text.slice(0, 80)}\n  ${created.link}`);
        }
      }
    }

    rows.push({
      id: q.id, source: q.source, received_at: q.receivedAt, outlet: q.outlet, journalist: q.journalist,
      deadline: q.deadline, category, query_text: q.query_text, fit_score: fitScore, fit_reason: fitReason,
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

  return NextResponse.json({
    from: "journo-queries", ok: true, dry: false,
    messagesFound: messageIds.length, blocksParsed: parsed.length, newQueries: fresh.length, capped,
    triaged: batch.length, drafted, notified,
  });
}

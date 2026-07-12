// Outreach auto-advance cron (every 6h). Reads the gotcosy@gmail.com mailbox to move BOTH boards'
// cards forward without manual clicks (badge outreach via hotel_outreach; PR board via the
// `outreach` table keyed by prActions card id):
//   queued    → contacted   when we've SENT a pitch to the hotel's email (in:sent to:<email>)
//   contacted → replied     when the hotel has REPLIED (in:inbox from:<email>)
// It NEVER downgrades a status and NEVER touches won / won_confirmed / declined — those are human-set.
//
// Vercel invokes this with the CRON_SECRET Bearer; middleware fail-closed-gates /api/cron/*, and we
// re-check here too. Idempotent: re-running is a no-op once statuses have advanced.
//
// DEPENDENCY: reading Sent/Inbox needs the gmail.readonly scope. Until Per re-runs scripts/gmail-auth.mjs
// and replaces GMAIL_REFRESH_TOKEN, gmail.ts throws GmailScopeError and this cron returns a graceful
// 200 {ok:false, error:"…needs readonly scope…"} rather than crashing.
//
// Query params:
//   ?dry=1   do everything EXCEPT DB writes; return what it WOULD change.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAccessToken, wasDeliveredTo, gotReplyFrom, GmailScopeError } from "@/lib/gmail";
import { PR_ACTIONS } from "@/data/prActions";

export const runtime = "nodejs";
export const maxDuration = 300;

// Cap Gmail work per run: 2 list calls per row worst case, so ~80 rows keeps us well within the
// 300s budget and Gmail's per-user quota. If more rows are eligible, the next 6h run picks them up.
const MAX_ROWS_PER_RUN = 80;

interface OutreachRow { hotel_id: string; status: string }

// Best-effort Telegram ping (same pattern/channel as reddit-scan). No-op when env unset; never throws.
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

// Failure alert (gap-sweep finding): every ok:false exit below returned silently, so a dead
// token read as a quiet week. Ping Telegram before returning so the founder learns within one
// cron cycle. Reuses pushTelegram (best-effort); dry runs never alert; never throws.
async function alertFailure(reason: string, dry: boolean): Promise<void> {
  if (dry) return;
  try {
    await pushTelegram(`⚠️ outreach-sync FAILED: ${reason}`.slice(0, 200));
  } catch {
    /* fail-open: alerting must never break the response */
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
    await alertFailure("Supabase not configured", dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  // Refresh the Gmail access token up front. A missing-env or insufficient-scope failure returns a
  // graceful 200 so a broken/unconfigured token never crashes the cron (and Per sees the fix hint).
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    const scopeHint = "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN";
    const error = e instanceof GmailScopeError ? scopeHint : `${scopeHint} (${String(e instanceof Error ? e.message : e)})`;
    await alertFailure(error, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error });
  }

  // Pull outreach cards still in the two auto-advanceable states, plus their hotel email.
  const { data: rows, error: rowsErr } = await db
    .from("hotel_outreach")
    .select("hotel_id, status")
    .in("status", ["queued", "contacted"]);
  if (rowsErr) {
    await alertFailure(rowsErr.message, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error: rowsErr.message }, { status: 500 });
  }

  const outreach = (rows || []) as OutreachRow[];
  const hotelIds = outreach.map((r) => r.hotel_id);

  // Map hotel_id → email (only hotels with a usable email are processable).
  const emailByHotel = new Map<string, string>();
  if (hotelIds.length) {
    const { data: hotels, error: hotelsErr } = await db
      .from("hotels")
      .select("id, email")
      .in("id", hotelIds);
    if (hotelsErr) {
      await alertFailure(hotelsErr.message, dry);
      return NextResponse.json({ from: "outreach-sync", ok: false, error: hotelsErr.message }, { status: 500 });
    }
    for (const h of (hotels || []) as Array<{ id: string; email: string | null }>) {
      const email = (h.email || "").trim();
      if (email) emailByHotel.set(String(h.id), email);
    }
  }

  // Only rows whose hotel has an email are actionable; cap the batch for quota/time.
  const actionable = outreach.filter((r) => emailByHotel.has(r.hotel_id));
  const capped = actionable.length > MAX_ROWS_PER_RUN;
  const batch = actionable.slice(0, MAX_ROWS_PER_RUN);

  let checked = 0;
  let advancedContacted = 0;
  let advancedReplied = 0;
  const wouldChange: Array<{ hotel_id: string; from: string; to: string }> = [];

  try {
    for (const row of batch) {
      const email = emailByHotel.get(row.hotel_id)!;
      checked++;

      if (row.status === "queued") {
        // Advance only if the latest send actually DELIVERED — a blocked send still leaves a Sent copy,
        // so a plain "was it sent" check would wrongly re-advance the 213 Zoho-blocked cards.
        if (await wasDeliveredTo(email, accessToken)) {
          wouldChange.push({ hotel_id: row.hotel_id, from: "queued", to: "contacted" });
          if (!dry) {
            const now = new Date().toISOString();
            const { error } = await db
              .from("hotel_outreach")
              .update({ status: "contacted", contacted_at: now, updated_at: now })
              .eq("hotel_id", row.hotel_id)
              .eq("status", "queued"); // guard: never clobber a concurrent human change
            if (error) {
              await alertFailure(error.message, dry);
              return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
            }
          }
          advancedContacted++;
        }
      } else if (row.status === "contacted") {
        if (await gotReplyFrom(email, accessToken)) {
          wouldChange.push({ hotel_id: row.hotel_id, from: "contacted", to: "replied" });
          if (!dry) {
            const { error } = await db
              .from("hotel_outreach")
              .update({ status: "replied", updated_at: new Date().toISOString() })
              .eq("hotel_id", row.hotel_id)
              .eq("status", "contacted");
            if (error) {
              await alertFailure(error.message, dry);
              return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
            }
          }
          advancedReplied++;
        }
      }
    }
  } catch (e) {
    // A scope error can surface mid-loop (e.g. token downgraded); return graceful 200 with the hint.
    if (e instanceof GmailScopeError) {
      const error = "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN";
      await alertFailure(error, dry);
      return NextResponse.json({ from: "outreach-sync", ok: false, error, checked });
    }
    const error = String(e instanceof Error ? e.message : e);
    await alertFailure(error, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error, checked }, { status: 502 });
  }

  // ── PR-board targets (founder ask 2026-07-09: queued→contacted→replied advance automatically) ──
  // Targets = prActions cards with a verified email. Missing `outreach` row = queued (the board's
  // default). Human-only states (won / confirmed / declined) and replied are never touched; the
  // eq-status guards below make concurrent human clicks win. Publication→won detection is a TODO
  // wired to the weekly mention tracker, not this cron.
  let prContacted = 0;
  let prReplied = 0;
  const prWouldChange: Array<{ id: string; from: string; to: string }> = [];
  try {
    const prTargets = Object.entries(PR_ACTIONS)
      .map(([id, a]) => ({ id, email: (a.pitch?.to || "").trim() }))
      .filter((t) => t.email);
    const { data: prRows } = await db.from("outreach").select("id, status").in("id", prTargets.map((t) => t.id));
    const prStatus = new Map(((prRows || []) as Array<{ id: string; status: string }>).map((r) => [r.id, r.status]));
    for (const t of prTargets) {
      let cur = prStatus.get(t.id) || "queued";
      if (cur === "queued" && (await wasDeliveredTo(t.email, accessToken))) {
        prWouldChange.push({ id: t.id, from: "queued", to: "contacted" });
        if (!dry) {
          const now = new Date().toISOString();
          const { error } = await db.from("outreach").upsert({ id: t.id, status: "contacted", updated_at: now });
          if (error) {
            await alertFailure(error.message, dry);
            return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
          }
        }
        prContacted++;
        cur = "contacted";
      }
      if (cur === "contacted" && (await gotReplyFrom(t.email, accessToken))) {
        prWouldChange.push({ id: t.id, from: "contacted", to: "replied" });
        if (!dry) {
          const { error } = await db
            .from("outreach")
            .update({ status: "replied", updated_at: new Date().toISOString() })
            .eq("id", t.id)
            .eq("status", "contacted");
          if (error) {
            await alertFailure(error.message, dry);
            return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
          }
        }
        prReplied++;
      }
    }
  } catch (e) {
    if (e instanceof GmailScopeError) {
      const error = "Gmail needs readonly scope — re-run scripts/gmail-auth.mjs";
      await alertFailure(error, dry);
      return NextResponse.json({ from: "outreach-sync", ok: false, error, checked });
    }
    const error = String(e instanceof Error ? e.message : e);
    await alertFailure(error, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error, checked }, { status: 502 });
  }

  const advanced = advancedContacted + advancedReplied + prContacted + prReplied;
  let notified = false;
  if (advanced > 0 && !dry) {
    notified = await pushTelegram(
      `${advanced} outreach card${advanced > 1 ? "s" : ""} auto-advanced (badge: ${advancedContacted} contacted / ${advancedReplied} replied; PR: ${prContacted} contacted / ${prReplied} replied).\n\nBoards → https://gotcosy.com/growth/pr and /badge-outreach`,
    );
  }

  return NextResponse.json({
    from: "outreach-sync",
    ok: true,
    dry,
    checked,
    advancedContacted,
    advancedReplied,
    prContacted,
    prReplied,
    prWouldChange,
    capped,
    notified,
    ...(dry ? { wouldChange } : {}),
  });
}

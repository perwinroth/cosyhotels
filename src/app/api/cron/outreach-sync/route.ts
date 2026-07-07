// Badge-outreach auto-advance cron (every 6h). Reads the gotcosy@gmail.com mailbox to move outreach
// cards forward without manual clicks:
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

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ from: "outreach-sync", ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  // Refresh the Gmail access token up front. A missing-env or insufficient-scope failure returns a
  // graceful 200 so a broken/unconfigured token never crashes the cron (and Per sees the fix hint).
  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (e) {
    const scopeHint = "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN";
    return NextResponse.json({
      from: "outreach-sync",
      ok: false,
      error: e instanceof GmailScopeError ? scopeHint : `${scopeHint} (${String(e instanceof Error ? e.message : e)})`,
    });
  }

  // Pull outreach cards still in the two auto-advanceable states, plus their hotel email.
  const { data: rows, error: rowsErr } = await db
    .from("hotel_outreach")
    .select("hotel_id, status")
    .in("status", ["queued", "contacted"]);
  if (rowsErr) {
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
            if (error) return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
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
            if (error) return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
          }
          advancedReplied++;
        }
      }
    }
  } catch (e) {
    // A scope error can surface mid-loop (e.g. token downgraded); return graceful 200 with the hint.
    if (e instanceof GmailScopeError) {
      return NextResponse.json({
        from: "outreach-sync",
        ok: false,
        error: "Gmail not configured / needs readonly scope — re-run scripts/gmail-auth.mjs and update GMAIL_REFRESH_TOKEN",
        checked,
      });
    }
    return NextResponse.json({ from: "outreach-sync", ok: false, error: String(e instanceof Error ? e.message : e), checked }, { status: 502 });
  }

  const advanced = advancedContacted + advancedReplied;
  let notified = false;
  if (advanced > 0 && !dry) {
    notified = await pushTelegram(
      `${advanced} outreach card${advanced > 1 ? "s" : ""} auto-advanced (${advancedContacted} contacted, ${advancedReplied} replied).\n\nBoard → https://gotcosy.com/badge-outreach`,
    );
  }

  return NextResponse.json({
    from: "outreach-sync",
    ok: true,
    dry,
    checked,
    advancedContacted,
    advancedReplied,
    capped,
    notified,
    ...(dry ? { wouldChange } : {}),
  });
}

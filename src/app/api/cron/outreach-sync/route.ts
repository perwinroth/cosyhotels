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
import { fetchVerifiedHotelIds } from "@/lib/verificationGate";
import { PR_ACTIONS } from "@/data/prActions";
import { DELISTED_SLUGS } from "@/lib/delisted";

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

  // Founder eyeball-verification gate (2026-07-16): a hotel may only be advanced by this cron once
  // a human has confirmed its stored website via /growth/verify (hotel_verifications.founder_status
  // = 'verified'). FAIL-CLOSED: if the check itself fails (table missing, query error), process
  // NOTHING and alert loudly. This must never silently fall back to "couldn't check, so advance
  // everything". This is deliberate: the founder demands only-verified outreach.
  const verifyGate = await fetchVerifiedHotelIds(db);
  if (!verifyGate.ok) {
    const error = `Founder verification gate unavailable (${verifyGate.error || "unknown error"}). Refusing to advance ANY hotel. Run sql/hotel-verifications.sql then scripts/import-link-verdicts.mjs --execute.`;
    await alertFailure(error, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error }, { status: 500 });
  }
  const verifiedHotelIds = verifyGate.ids;

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
  // EMAIL-TRACK ONLY: mailbox evidence can only ever advance rows with an email identity; the
  // 2026-07-11 seeding added 1,639 instagram-channel rows and the unfiltered select pushed the
  // downstream hotels .in() past PostgREST's URL limit -> 400 Bad Request (same class as the
  // 2026-07-02 city-scores incident). IG rows are founder-marked on the board, never here.
  // ROTATION: actionable email rows (215+) exceed MAX_ROWS_PER_RUN, so process the least-recently-
  // checked first (never-checked NULLs lead) and stamp last_checked_at on every examined row below.
  // Without this the same first 80 ran every cycle and the ~135-row tail could never advance.
  const { data: rows, error: rowsErr } = await db
    .from("hotel_outreach")
    .select("hotel_id, status, channel")
    .in("status", ["queued", "contacted"])
    .or("channel.is.null,channel.eq.email")
    .order("last_checked_at", { ascending: true, nullsFirst: true });
  if (rowsErr) {
    await alertFailure(rowsErr.message, dry);
    return NextResponse.json({ from: "outreach-sync", ok: false, error: rowsErr.message }, { status: 500 });
  }

  const outreach = (rows || []) as OutreachRow[];
  const hotelIds = outreach.map((r) => r.hotel_id);

  // Map hotel_id → email (only hotels with a usable email are processable). Also collect delisted
  // hotel_ids (takedown mechanism, trust fix 2026-07-16) so a delisted hotel is never advanced or
  // mailed by this cron — belt and braces: the DELISTED_SLUGS Set works unconditionally; the
  // hotels.delisted_at column is read defensively (select falls back without it if the column
  // doesn't exist yet — sql/hotel-delist.sql is a separate founder-run migration).
  const emailByHotel = new Map<string, string>();
  const delistedHotelIds = new Set<string>();
  if (hotelIds.length) {
    // Chunked defensively: .in() with hundreds of UUIDs overflows the request URL (400).
    type HotelRow = { id: string; email: string | null; slug: string | null; delisted_at?: string | null };
    const hotels: HotelRow[] = [];
    for (let i = 0; i < hotelIds.length; i += 150) {
      const idsChunk = hotelIds.slice(i, i + 150);
      let chunk: HotelRow[] | null = null;
      const withDelisted = await db.from("hotels").select("id, email, slug, delisted_at").in("id", idsChunk);
      if (!withDelisted.error) {
        chunk = withDelisted.data as HotelRow[];
      } else {
        // delisted_at may not exist yet (pre-migration) — retry without it rather than failing the cron.
        const { data: fallback, error: fallbackErr } = await db.from("hotels").select("id, email, slug").in("id", idsChunk);
        if (fallbackErr) {
          await alertFailure(fallbackErr.message, dry);
          return NextResponse.json({ from: "outreach-sync", ok: false, error: fallbackErr.message }, { status: 500 });
        }
        chunk = (fallback || []) as HotelRow[];
      }
      hotels.push(...(chunk || []));
    }
    for (const h of hotels) {
      if (DELISTED_SLUGS.has(String(h.slug || "")) || h.delisted_at) { delistedHotelIds.add(String(h.id)); continue; }
      const email = (h.email || "").trim();
      if (email) emailByHotel.set(String(h.id), email);
    }
  }

  // Only rows whose hotel has an email, isn't delisted, AND has passed founder eyeball-verification
  // are actionable; cap the batch for quota/time.
  const actionable = outreach.filter(
    (r) => emailByHotel.has(r.hotel_id) && !delistedHotelIds.has(r.hotel_id) && verifiedHotelIds.has(r.hotel_id),
  );
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
      const now = new Date().toISOString();
      let advanced = false;

      if (row.status === "queued") {
        // Advance only if the latest send actually DELIVERED — a blocked send still leaves a Sent copy,
        // so a plain "was it sent" check would wrongly re-advance the 213 Zoho-blocked cards.
        if (await wasDeliveredTo(email, accessToken)) {
          wouldChange.push({ hotel_id: row.hotel_id, from: "queued", to: "contacted" });
          if (!dry) {
            const { error } = await db
              .from("hotel_outreach")
              .update({ status: "contacted", contacted_at: now, updated_at: now, last_checked_at: now })
              .eq("hotel_id", row.hotel_id)
              .eq("status", "queued"); // guard: never clobber a concurrent human change
            if (error) {
              await alertFailure(error.message, dry);
              return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
            }
          }
          advancedContacted++;
          advanced = true;
        }
      } else if (row.status === "contacted") {
        if (await gotReplyFrom(email, accessToken)) {
          wouldChange.push({ hotel_id: row.hotel_id, from: "contacted", to: "replied" });
          if (!dry) {
            const { error } = await db
              .from("hotel_outreach")
              .update({ status: "replied", updated_at: now, last_checked_at: now })
              .eq("hotel_id", row.hotel_id)
              .eq("status", "contacted");
            if (error) {
              await alertFailure(error.message, dry);
              return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
            }
          }
          advancedReplied++;
          advanced = true;
        }
      }

      // Rotation stamp: mark this row checked even when it didn't advance, so the ORDER BY
      // last_checked_at ASC moves it to the back and the next run covers the next slice. No status
      // guard needed — it never touches status. (Advanced rows already stamped last_checked_at above.)
      if (!advanced && !dry) {
        const { error } = await db
          .from("hotel_outreach")
          .update({ last_checked_at: now })
          .eq("hotel_id", row.hotel_id);
        if (error) {
          await alertFailure(error.message, dry);
          return NextResponse.json({ from: "outreach-sync", ok: false, error: error.message }, { status: 500 });
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
      .map(([id, a]) => ({ id, email: (a.pitch?.to || "").trim(), outlet: a.outlet }))
      .filter((t) => t.email);
    const { data: prRows } = await db.from("outreach").select("id, status").in("id", prTargets.map((t) => t.id));
    const prStatus = new Map(((prRows || []) as Array<{ id: string; status: string }>).map((r) => [r.id, r.status]));
    for (const t of prTargets) {
      let cur = prStatus.get(t.id) || "queued";
      if (cur === "queued" && (await wasDeliveredTo(t.email, accessToken))) {
        prWouldChange.push({ id: t.id, from: "queued", to: "contacted" });
        if (!dry) {
          const now = new Date().toISOString();
          // outlet is NOT NULL with no default; Postgres checks it on the proposed insert tuple even
          // for an existing id (ON CONFLICT DO UPDATE), so omitting it crashed this cron every run.
          const { error } = await db.from("outreach").upsert({ id: t.id, outlet: t.outlet, status: "contacted", updated_at: now });
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

// Weekly Reddit lead-finder cron (WP5). Vercel invokes this Mondays 05:30 UTC with the CRON_SECRET
// Bearer; middleware already fail-closed-gates /api/cron/* on that secret, and we re-check here too.
//
// It runs Apify's Google-search actor over a ROTATING subset of our guide cities (all ~25 covered
// every ~3 weeks — see citiesForWeek), parses recommendation-request threads, dedupes against the
// reddit_leads primary key, and inserts fresh rows with status 'new' so they land in the New column
// of /growth/reddit. READ-ONLY toward Reddit — we NEVER auto-post (ban-safe); Per replies manually.
//
// Query params (both optional):
//   ?limit=N   cap the number of cities this run (testing / smaller batch)
//   ?dry=1     run the search + parse but skip ALL DB access; return candidates only (read-only probe)
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { REDDIT_CITIES, queryFor, runActor, parseLeads, citiesForWeek, isoWeek } from "@/lib/redditScan";
import { isControlMarket } from "@/lib/controlMarkets";

export const runtime = "nodejs";
export const maxDuration = 300;

// Best-effort Telegram ping so Per gets new Reddit leads on his phone (same channel as the PR-digest
// triage). No-op when the env vars are unset; never throws — a Telegram hiccup must not fail the cron
// or lose the DB write that already succeeded.
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

  const { searchParams } = new URL(req.url);
  const dry = searchParams.get("dry") === "1";
  const limitParam = parseInt(searchParams.get("limit") || "", 10);

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    // Don't crash the cron: report clearly so Per knows to add the Vercel env var.
    return NextResponse.json({
      from: "reddit-scan",
      ok: false,
      error: "APIFY_TOKEN not set — add it to Vercel env for the Reddit scan to run.",
      inserted: 0,
    });
  }

  // Rotate through the city list by ISO week; ?limit trims the batch further for testing.
  // Control markets (Savannah/York, src/lib/controlMarkets.ts) are excluded from the search
  // entirely: replying to their threads would contaminate the GSC treated-vs-control measurement,
  // and searching them would only spend Apify budget on leads we must never action.
  let cities = citiesForWeek(isoWeek(), REDDIT_CITIES).filter((c) => !isControlMarket(c));
  if (Number.isFinite(limitParam) && limitParam > 0) cities = cities.slice(0, limitParam);

  let items: Array<Record<string, unknown>> = [];
  let actorStatus = "UNKNOWN";
  let costUsd = 0;
  try {
    const res = await runActor(cities.map(queryFor), token);
    items = res.items;
    actorStatus = res.status;
    costUsd = res.costUsd;
  } catch (e) {
    return NextResponse.json({
      from: "reddit-scan",
      ok: false,
      error: `actor_failed:${String(e)}`,
      cities,
      inserted: 0,
    }, { status: 502 });
  }

  // Belt and braces: even with control cities never searched, a stray result attributed to a
  // control market must not become an actionable lead.
  const found = parseLeads(items, cities).filter((l) => !isControlMarket(l.city) && !isControlMarket(l.subreddit));

  if (dry) {
    return NextResponse.json({
      from: "reddit-scan",
      dry: true,
      week: isoWeek(),
      cities,
      actorStatus,
      costUsd,
      candidates: found.length,
      leads: found.map((l) => ({ city: l.city, subreddit: l.subreddit, title: l.title, url: l.url })),
    });
  }

  const db = getServerSupabase();
  if (!db) {
    return NextResponse.json({ from: "reddit-scan", ok: false, error: "Supabase not configured", inserted: 0 }, { status: 500 });
  }

  let inserted = 0;
  let known = 0;
  let notified = false;
  if (found.length) {
    const { data: existing } = await db.from("reddit_leads").select("id").in("id", found.map((l) => l.id));
    const have = new Set((existing || []).map((r) => (r as { id: string }).id));
    const fresh = found.filter((l) => !have.has(l.id)).map((l) => ({ ...l, status: "new" as const }));
    known = found.length - fresh.length;
    if (fresh.length) {
      const { error } = await db.from("reddit_leads").insert(fresh);
      if (error) {
        return NextResponse.json({ from: "reddit-scan", ok: false, error: error.message, inserted: 0 }, { status: 500 });
      }
      inserted = fresh.length;
      // Ping Per with the fresh leads (up to 6 lines) + a link to reply. Best-effort — the DB write
      // above already succeeded, so a Telegram failure just means no push, not a lost lead.
      const lines = fresh.slice(0, 6).map((l) => `• r/${l.subreddit}: ${l.title}`);
      const more = fresh.length > 6 ? `\n…and ${fresh.length - 6} more` : "";
      notified = await pushTelegram(
        `${fresh.length} new Reddit lead${fresh.length > 1 ? "s" : ""} to reply to:\n${lines.join("\n")}${more}\n\nReply → https://gotcosy.com/growth/reddit`,
      );
    }
  }

  return NextResponse.json({
    from: "reddit-scan",
    ok: true,
    week: isoWeek(),
    cities,
    actorStatus,
    costUsd,
    candidates: found.length,
    inserted,
    alreadyKnown: known,
    notified,
  });
}

// Clean cron entry point (Vercel cron paths can't have query strings). Vercel invokes this daily
// with the CRON_SECRET Bearer; it triggers the auto-rotating Pinterest publish, capped at 2 pins/run.
//
// ⚠ NOT YET SCHEDULED in vercel.json. Blotato refuses to post to a Pinterest account until it has
// ~100+ views/month (anti-shadowban gate); the gotcosy account isn't there yet (verified 2026-07-04
// — the API returned a "warm up 2 weeks / reach 100+ views then reconnect" error). Keep pinning
// MANUALLY (ramp 1→2→3/day) to grow views; once at 100+/month, RECONNECT the account in Blotato to
// auto-verify, THEN add this route to vercel.json crons (schedule e.g. "0 19 * * *") to go live.
// Everything else (per-hotel pin engine, board default, limit knob) is ready.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";
  const r = await fetch(`${base}/api/cron/social-publish?auto=1&only=pinterest&limit=2`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
  const result = await r.json().catch(() => ({}));
  return NextResponse.json({ from: "pinterest-daily", status: r.status, result });
}

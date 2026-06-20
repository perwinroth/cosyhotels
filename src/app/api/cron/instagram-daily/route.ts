// Clean cron entry point (Vercel cron paths can't have query strings). Vercel invokes this
// daily with the CRON_SECRET Bearer; it triggers the auto-rotating Instagram publish.
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
  const r = await fetch(`${base}/api/cron/social-publish?auto=1&only=instagram`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });
  const result = await r.json().catch(() => ({}));
  return NextResponse.json({ from: "instagram-daily", status: r.status, result });
}

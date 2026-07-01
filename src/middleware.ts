import { NextResponse, type NextRequest } from "next/server";

// Canonical-domain migration: gotcosy.com is the single canonical host.
// 308 (permanent) redirect every other host to it, preserving the path + query.
const CANONICAL = "gotcosy.com";
const REDIRECT_HOSTS = new Set([
  "www.gotcosy.com",
  "cosyhotelroom.com",
  "www.cosyhotelroom.com",
]);

export function middleware(req: NextRequest) {
  // SECURITY: gate every admin + cron endpoint. These mutate data or spend money
  // (recompute-scores burns Anthropic credits, populate/grow cost, admin/* writes the DB), so
  // they must never be publicly callable. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`
  // automatically; manual calls pass ?key=. Fail-closed: no secret set → everything 401s.
  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/admin/") || path.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization") || "";
    const key = req.nextUrl.searchParams.get("key");
    if (!secret || (auth !== `Bearer ${secret}` && key !== secret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // SECURITY: gate the internal PAGE dashboards (/growth, /admin, and their locale variants).
  // These surface internal growth metrics + the outreach pipeline — noindex is not a lock.
  // Unlock once with ?key=<CRON_SECRET>; we then set an httpOnly cookie so it sticks. Fail-closed.
  if (/^\/(?:[a-z]{2}\/)?(?:growth|admin)(?:\/|$)/.test(path)) {
    const secret = process.env.CRON_SECRET;
    const key = req.nextUrl.searchParams.get("key");
    const cookie = req.cookies.get("gc_panel")?.value;
    if (secret && key === secret) {
      const clean = new URL(req.url);
      clean.searchParams.delete("key");
      const res = NextResponse.redirect(clean);
      res.cookies.set("gc_panel", secret, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
    if (!secret || cookie !== secret) {
      return new NextResponse(
        '<!doctype html><meta charset=utf8><title>Locked</title><body style="background:#0f1512;color:#f3eee6;font:15px/1.6 system-ui;max-width:36rem;margin:12vh auto;padding:0 1.5rem"><h1 style="font-family:Georgia,serif">Locked</h1><p>Internal Got Cosy panel. Append <code style="color:#e08a4b">?key=YOUR_CRON_SECRET</code> to the URL to unlock (it will remember you after that).</p></body>',
        { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
      );
    }
  }

  const host = (req.headers.get("host") || "").split(":")[0].toLowerCase();
  if (REDIRECT_HOSTS.has(host)) {
    const url = new URL(req.url);
    url.protocol = "https:";
    url.host = CANONICAL;
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals / static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

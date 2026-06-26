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

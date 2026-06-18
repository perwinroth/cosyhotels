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

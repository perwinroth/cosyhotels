import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = url.hostname;
  const isLocal = host === "localhost" || host.endsWith(".local");
  const isVercelPreview = host.endsWith(".vercel.app");

  // Enforce www on production domain
  if (!isLocal && !isVercelPreview) {
    if (host === "cosyhotelroom.com") {
      const to = new URL(url);
      to.hostname = "www.cosyhotelroom.com";
      return NextResponse.redirect(to, 308);
    }
  }

  // Redirect root to default locale
  if (url.pathname === "/") {
    const to = new URL(url);
    to.pathname = "/en";
    return NextResponse.redirect(to, 308);
  }

  return NextResponse.next();
}

import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Only handle root → /en here to avoid domain-level redirect loops.
  if (url.pathname === "/") {
    const to = new URL(url);
    to.pathname = "/en";
    return NextResponse.redirect(to, 308);
  }

  return NextResponse.next();
}

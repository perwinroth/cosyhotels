import { NextResponse, NextRequest } from "next/server";

export function middleware(_req: NextRequest) {
  // No redirects here to avoid loops; domain enforcement handled in Vercel.
  return NextResponse.next();
}

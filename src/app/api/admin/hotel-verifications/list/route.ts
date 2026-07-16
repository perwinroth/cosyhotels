import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getVerificationPage, getVerificationCounts } from "@/lib/hotelVerificationBoard";

// Lazy-load pagination for /growth/verify. page.tsx SSRs page 0; the client board calls this for
// every "Load more" click (same verdict/status filters, next page). Auth: middleware gates
// /api/admin/* (panel cookie).
export async function GET(req: Request) {
  const db = getServerSupabase();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 500 });

  const url = new URL(req.url);
  const page = Math.max(0, Number(url.searchParams.get("page") || "0") || 0);
  const verdict = url.searchParams.get("verdict") || "ALL";
  const status = url.searchParams.get("status") || "ALL";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

  try {
    const [{ rows, total }, counts] = await Promise.all([
      getVerificationPage(db, { verdict, status }, page, base),
      getVerificationCounts(db),
    ]);
    return NextResponse.json({ rows, total, page, counts });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

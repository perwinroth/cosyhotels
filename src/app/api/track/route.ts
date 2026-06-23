// First-party event logging for the /growth funnel dashboard. The client (Analytics.tsx) POSTs
// pageviews + CTA clicks here; we store them in Supabase so traffic/visitors/funnels are
// queryable in-app (no dependency on Vercel/GA APIs). Fire-and-forget, never blocks the UI.
import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const TYPES = new Set(["pageview", "cta_click"]);
const s = (v: unknown, n = 200) => (v == null ? null : String(v).slice(0, n));

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const type = String(body.type ?? "");
  if (!TYPES.has(type)) return NextResponse.json({ ok: false }, { status: 400 });

  const db = getServerSupabase();
  if (!db) return NextResponse.json({ ok: false }, { status: 200 }); // never error the client

  // Prefer explicit utm fields; fall back to a referrer host so direct/organic still attributes.
  let referrer: string | null = null;
  try { const r = s(body.referrer); referrer = r ? new URL(r).host : null; } catch { referrer = s(body.referrer, 120); }

  await db.from("events").insert({
    type,
    path: s(body.path),
    source: s(body.source) || (referrer ? `ref:${referrer}` : "direct"),
    medium: s(body.medium),
    campaign: s(body.campaign),
    city: s(body.city),
    hotel: s(body.hotel),
    cta: s(body.cta, 60),
    visitor: s(body.visitor, 64),
    referrer,
  }).then(() => {}, () => {}); // swallow — analytics must never break a page

  return NextResponse.json({ ok: true });
}

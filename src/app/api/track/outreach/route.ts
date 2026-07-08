// First-party outreach-visit counter (pre-registered v3 outcome metric). Analytics.tsx POSTs here
// once per session when a visitor lands with utm_source=outreach; we persist it in Supabase
// (outreach_visits) because GSC cannot see email-driven visits and Vercel's log retention is 1h.
// Only utm_source=outreach is accepted; everything else is silently dropped. Responds 204 ALWAYS
// (bad JSON, missing table, RLS, wrong source) so tracking can never error a visitor's page.
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const s = (v: unknown, n = 200) => (v == null ? null : String(v).slice(0, n));

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    if (String(body.utm_source ?? "") === "outreach") {
      const db = getServerSupabase();
      if (db) {
        await db
          .from("outreach_visits")
          .insert({
            path: s(body.path),
            utm_source: "outreach",
            utm_campaign: s(body.utm_campaign, 120),
            referrer: s(body.referrer),
          })
          .then(() => {}, () => {}); // fail-soft: table missing / RLS / network must not surface
      }
    }
  } catch {
    /* never error to the client */
  }
  return new Response(null, { status: 204 });
}

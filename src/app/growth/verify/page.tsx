// Founder eyeball-verification board (2026-07-16). An automated Haiku pass judged ~12k hotels'
// stored websites (die-validation data/hotel-link-verdicts.json → hotel_verifications.auto_*,
// scripts/import-link-verdicts.mjs). The founder demands 100% accuracy on outreach: nothing gets
// pitched until a HUMAN has looked at the link and confirmed it here. The outreach gate
// (src/lib/verificationGate.ts, scripts/verification-gate.mjs) enforces founder_status='verified'
// before any hotel can be queued or advanced in an outreach lane.
//
// SSRs page 0 (fast first paint, no client waterfall); <VerifyBoard> lazy-loads further pages via
// GET /api/admin/hotel-verifications/list as the founder scrolls. Renders inside the /growth shell
// (middleware-gated, same as every other board; see src/middleware.ts).
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { getVerificationPage, getVerificationCounts, VERDICTS, FOUNDER_STATUSES } from "@/lib/hotelVerificationBoard";
import VerifyBoard from "@/components/growth/VerifyBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Link verification", robots: { index: false, follow: false } };

export default async function GrowthVerifyPage({ searchParams }: { searchParams?: { verdict?: string; status?: string } }) {
  const db = getServerSupabase();
  if (!db) return <p style={{ color: "var(--muted)" }}>Supabase not configured.</p>;

  const verdict = VERDICTS.includes((searchParams?.verdict || "") as (typeof VERDICTS)[number]) ? String(searchParams?.verdict) : "ALL";
  // Default view is "needing eyes" (pending decisions) unless the founder explicitly switches tabs.
  const status = FOUNDER_STATUSES.includes((searchParams?.status || "") as (typeof FOUNDER_STATUSES)[number]) ? String(searchParams?.status) : "pending";
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

  let rows: Awaited<ReturnType<typeof getVerificationPage>>["rows"] = [];
  let total = 0;
  let counts = { pending: 0, verified: 0, rejected: 0 };
  let tableMissing = false;
  try {
    [{ rows, total }, counts] = await Promise.all([
      getVerificationPage(db, { verdict, status }, 0, base),
      getVerificationCounts(db),
    ]);
  } catch {
    tableMissing = true; // hotel_verifications not migrated yet; sql/hotel-verifications.sql first
  }

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Link verification</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>
          Every hotel here needs a human look before it can be pitched. Open the stored website, confirm it&apos;s the right
          hotel, then mark it. Outreach is gated on this: nothing sends until founder_status is &quot;verified&quot;.
        </p>
      </header>
      {tableMissing ? (
        <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 16, color: "var(--muted)" }}>
          hotel_verifications isn&apos;t set up yet. Run <code>sql/hotel-verifications.sql</code> in the Supabase SQL editor, then{" "}
          <code>node --env-file=.env.local scripts/import-link-verdicts.mjs --execute</code>.
        </div>
      ) : (
        <VerifyBoard initialRows={rows} initialTotal={total} counts={counts} initialVerdict={verdict} initialStatus={status} />
      )}
    </div>
  );
}

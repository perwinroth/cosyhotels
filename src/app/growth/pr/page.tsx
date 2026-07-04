// PR & backlink outreach — kanban board. Ports the outreach query from the old /growth monolith
// (live `outreach` table, falling back to the committed outreach.json snapshot) and hands it to the
// client <PrBoard>. Renders inside the /growth shell layout: just a heading + the board.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import outreachData from "@/data/outreach.json";
import { gmailConfigured } from "@/lib/gmail";
import PrBoard, { type PrRow } from "@/components/growth/PrBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "PR outreach", robots: { index: false, follow: false } };

const snapshot = outreachData as unknown as PrRow[];

export default async function GrowthPrPage() {
  const db = getServerSupabase();
  let rows: PrRow[] = snapshot;
  if (db) {
    try {
      const { data } = await db.from("outreach").select("id,outlet,type,fit,email,contact_route,region,notes,rec,status");
      if (data && data.length) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rows = data.map((r: any) => ({ id: r.id, outlet: r.outlet, type: r.type, fit: r.fit, email: r.email || "", contactRoute: r.contact_route || "", region: r.region || "", notes: r.notes || "", rec: r.rec ?? undefined, status: r.status || "queued" }));
      }
    } catch { /* table not created yet — use snapshot */ }
  }
  const gmailOn = gmailConfigured();

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>PR &amp; backlink outreach</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>Work the ★ start-here targets first. Draft in Gmail, send, then advance the card stage by stage.</p>
      </header>
      <PrBoard rows={rows} gmailOn={gmailOn} />
    </div>
  );
}

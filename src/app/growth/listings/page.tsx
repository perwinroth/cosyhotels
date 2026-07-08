// /growth/listings: directory and entity-profile submissions (the backl.io play, built ourselves).
// Targets + copy kit live in src/data/listingTargets.ts; statuses in the listing_status table
// (supabase/2026_listing_status.sql). Missing table degrades gracefully: every target renders as
// queued and the board says statuses are not persisting.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { LISTING_KIT, LISTING_TARGETS } from "@/data/listingTargets";
import ListingsBoard, { type ListingRow } from "@/components/growth/ListingsBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = { title: "Listings & directories", robots: { index: false, follow: false } };

export default async function GrowthListingsPage() {
  const db = getServerSupabase();
  const statusById = new Map<string, string>();
  if (db) {
    try {
      const { data } = await db.from("listing_status").select("id,status");
      for (const r of data ?? []) statusById.set(r.id as string, (r.status as string) || "queued");
    } catch { /* table not created yet; render all queued */ }
  }

  const rows: ListingRow[] = LISTING_TARGETS.map((t) => ({ ...t, status: statusById.get(t.id) || "queued" }));

  return (
    <div>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Listings &amp; directories</h1>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 5 }}>
          Entity profiles and directory submissions to establish the domain: copy each field from the kit, open the submit page, paste, mark the pill. Register everywhere with the account named in the kit.
        </p>
      </header>
      <ListingsBoard rows={rows} kit={LISTING_KIT} />
    </div>
  );
}

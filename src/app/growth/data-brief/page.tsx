// /growth/data-brief — the Character-lane data-brief outreach campaign, ready to send.
// Static, panel-gated by the same middleware as every /growth page. Sends are MANUAL by Per
// (from per@gotcosy.com via Zoho). Provenance + rules live in src/data/dataBriefCampaign.ts.
import type { Metadata } from "next";
import DataBriefBoard from "@/components/growth/DataBriefBoard";

export const metadata: Metadata = { title: "Data brief outreach", robots: { index: false, follow: false } };

export default function GrowthDataBriefPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold" style={{ fontFamily: "Fraunces, serif" }}>Data-brief outreach</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
        The host-gap finding (74% vs 26%) to 15 verified slow-travel / independent-hotel writers.
        Text is Challenger-approved: send as-is, personalize only the opener further if you know their work.
      </p>
      <div className="mt-5">
        <DataBriefBoard />
      </div>
    </div>
  );
}

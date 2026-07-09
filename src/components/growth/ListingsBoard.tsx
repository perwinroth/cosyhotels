"use client";
// Client board for /growth/listings: the copy kit up top (one copy button per form field), then the
// targets grouped by tier with status pills. Status persists via POST /api/admin/listing-status
// (Supabase listing_status table); if the table is missing the pill still flips locally and a small
// "not saved" hint appears, so chipping away never blocks on infra.
import { useState } from "react";
import type { KitField, ListingTarget } from "@/data/listingTargets";
import Linkify from "@/components/growth/Linkify";

export type ListingRow = ListingTarget & { status: string };

const STATUSES = ["queued", "submitted", "live", "skip"] as const;
const DONE = new Set(["submitted", "live", "skip"]);

const TIER_HEAD: Record<number, { title: string; text: string }> = {
  1: { title: "Tier 1 · Entity anchors", text: "Profiles that Knowledge Panels and AI crawlers read. Do these first; always register with the account in the kit." },
  2: { title: "Tier 2 · Startup directories", text: "Free or cheap, mostly dofollow. Paste from the kit; 5 to 15 minutes each. Two or three per sitting is plenty." },
  3: { title: "Tier 3 · Niche: AI and travel", text: "AI-tool directories (use the AI tagline) and travel listings. Lower priority than tiers 1 and 2." },
};

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-lg px-2.5 py-1 text-xs font-semibold"
      style={{ border: "1px solid var(--line)", background: done ? "var(--sage)" : "var(--card)", color: done ? "#fff" : "var(--foreground)", cursor: "pointer" }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* ignore */ }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

function KitPanel({ kit }: { kit: KitField[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Copy kit: every field a form asks for, pre-approved</span>
        <button type="button" onClick={() => setOpen(!open)} className="text-xs" style={{ color: "var(--muted)", cursor: "pointer", border: "none", background: "none" }}>
          {open ? "collapse" : "expand"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          {kit.map((f) => (
            <div key={f.label} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>{f.label}</span>
                <CopyBtn text={f.value} label="Copy" />
              </div>
              <div className="mt-1.5 text-sm" style={{ whiteSpace: "pre-wrap" }}>{f.value}</div>
              {f.hint && <div className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>{f.hint}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function chip(label: string, strong = false) {
  return (
    <span key={label} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: strong ? "var(--sage)" : "color-mix(in oklab, var(--muted) 18%, transparent)", color: strong ? "#fff" : "var(--muted)" }}>
      {label}
    </span>
  );
}

function Card({ row, status, saveFailed, onSet }: { row: ListingRow; status: string; saveFailed: boolean; onSet: (id: string, s: string) => void }) {
  const dimmed = DONE.has(status);
  return (
    <div className="rounded-2xl border p-4 mb-3" style={{ borderColor: dimmed ? "var(--sage)" : "var(--line)", background: "var(--card)", opacity: dimmed ? 0.55 : 1 }}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="font-semibold">{row.name}</span>
        {row.dr !== null && chip(`DR ${row.dr}`, row.dr >= 80)}
        {chip(row.cost)}
        {row.dofollow === true && chip("dofollow", true)}
        {row.dofollow === false && chip("nofollow")}
        {chip(row.effort)}
        <span className="ml-auto flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSet(row.id, s)}
              className="rounded-md px-2 py-0.5 text-[11px]"
              style={{ border: "1px solid var(--line)", background: status === s ? "var(--ember)" : "transparent", color: status === s ? "#16201C" : "var(--muted)", cursor: "pointer" }}
            >
              {s}
            </button>
          ))}
        </span>
      </div>
      <div className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>Form asks for: <Linkify text={row.fields} /></div>
      <div className="mt-1 text-sm"><Linkify text={row.note} /></div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <a
          className="rounded-lg px-2.5 py-1 text-xs font-bold no-underline"
          style={{ background: "var(--ember)", color: "#16201C" }}
          href={row.submitUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open submit page
        </a>
        {saveFailed && <span className="text-[11px]" style={{ color: "var(--ember)" }}>status not saved (run supabase/2026_listing_status.sql)</span>}
      </div>
    </div>
  );
}

export default function ListingsBoard({ rows, kit }: { rows: ListingRow[]; kit: KitField[] }) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const statusOf = (r: ListingRow) => statuses[r.id] ?? r.status;

  async function onSet(id: string, status: string) {
    setStatuses((m) => ({ ...m, [id]: status }));
    try {
      const r = await fetch("/api/admin/listing-status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
      setFailed((m) => ({ ...m, [id]: !r.ok }));
    } catch {
      setFailed((m) => ({ ...m, [id]: true }));
    }
  }

  const remaining = rows.filter((r) => !DONE.has(statusOf(r))).length;

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        {remaining} of {rows.length} still to submit. Work top down inside a tier; a couple per sitting is the pace. Where a note says a target is also on the PR board, tick it there too so the boards agree.
      </p>
      <KitPanel kit={kit} />
      {[1, 2, 3].map((tier) => {
        const sectionRows = rows.filter((r) => r.tier === tier);
        if (!sectionRows.length) return null;
        const head = TIER_HEAD[tier];
        return (
          <section key={tier} className="mb-6">
            <h2 className="font-display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>{head.title}</h2>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>{head.text}</p>
            {sectionRows.map((r) => (
              <Card key={r.id} row={r} status={statusOf(r)} saveFailed={Boolean(failed[r.id])} onSet={onSet} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

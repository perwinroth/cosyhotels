"use client";
// Client half of /growth/verify: progress counts, verdict + status filter tabs, the row list, and
// lazy "Load more" pagination (GET /api/admin/hotel-verifications/list). Decisions post to
// /api/admin/hotel-verifications and remove the row locally once it no longer matches the active
// status filter (mirrors the Kanban "discard" pattern used by the other growth boards).
import { useState } from "react";
import { cosyBadgeColor } from "@/lib/cosyColor";
import type { VerifyRow, VerifyCounts } from "@/lib/hotelVerificationBoard";

const VERDICT_TABS = [
  "ALL",
  "DIFFERENT",
  "HIJACKED",
  "CITY_MISMATCH",
  "INSUFFICIENT_EVIDENCE",
  "SAME_HOTEL",
  "SAME_GROUP",
  "MODEL_ERROR",
] as const;
const STATUS_TABS = ["pending", "verified", "rejected", "ALL"] as const;

const SEVERE = new Set(["DIFFERENT", "HIJACKED", "CITY_MISMATCH"]);

function verdictColor(v: string | null): string {
  if (!v) return "var(--muted)";
  if (SEVERE.has(v)) return "#c0392b";
  if (v === "INSUFFICIENT_EVIDENCE") return "var(--gold)";
  if (v === "MODEL_ERROR") return "var(--muted)";
  return "var(--sage)";
}

function Tab({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <a
      href={href}
      style={{
        display: "inline-block",
        padding: "5px 11px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        textDecoration: "none",
        border: "1px solid",
        borderColor: active ? "var(--ember)" : "var(--line)",
        background: active ? "var(--ember)" : "var(--card)",
        color: active ? "#16201C" : "var(--muted)",
      }}
    >
      {label}
    </a>
  );
}

function Progress({ counts }: { counts: VerifyCounts }) {
  const total = counts.pending + counts.verified + counts.rejected;
  const pct = (n: number) => (total ? Math.round((100 * n) / total) : 0);
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
        <span><strong style={{ fontFamily: "Fraunces, serif", fontSize: 18 }}>{counts.verified.toLocaleString()}</strong> <span style={{ color: "var(--muted)" }}>verified</span></span>
        <span><strong style={{ fontFamily: "Fraunces, serif", fontSize: 18 }}>{counts.pending.toLocaleString()}</strong> <span style={{ color: "var(--muted)" }}>pending</span></span>
        <span><strong style={{ fontFamily: "Fraunces, serif", fontSize: 18 }}>{counts.rejected.toLocaleString()}</strong> <span style={{ color: "var(--muted)" }}>rejected</span></span>
        <span style={{ color: "var(--muted)", marginLeft: "auto" }}>{total.toLocaleString()} total</span>
      </div>
      <div style={{ marginTop: 8, height: 6, borderRadius: 999, overflow: "hidden", display: "flex", background: "color-mix(in srgb, var(--muted) 20%, var(--card))" }}>
        <div style={{ width: `${pct(counts.verified)}%`, background: "var(--sage)" }} />
        <div style={{ width: `${pct(counts.rejected)}%`, background: "#c0392b" }} />
      </div>
    </div>
  );
}

function Row({ row, onDecide }: { row: VerifyRow; onDecide: (hotelId: string, decision: "verified" | "wrong_link" | "delist") => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function go(decision: "verified" | "wrong_link" | "delist") {
    if (busy) return;
    setBusy(decision);
    await onDecide(row.hotelId, decision);
    setBusy(null);
  }
  const btn = (bg: string, fg: string): React.CSSProperties => ({
    border: "none", background: bg, color: fg, borderRadius: 7, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--line)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        {row.score != null && (
          <span style={{ flex: "none", width: 38, height: 38, borderRadius: 8, background: cosyBadgeColor(row.score), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces, serif", fontSize: 14, fontWeight: 700 }}>
            {row.score.toFixed(1)}
          </span>
        )}
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{row.name}</span>
            {row.queued && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "var(--ember)", color: "#16201C" }}>QUEUED</span>
            )}
            {row.founderStatus !== "pending" && (
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: row.founderStatus === "verified" ? "var(--sage)" : "#c0392b", color: "#fff" }}>
                {row.founderStatus.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12.5, marginTop: 2 }}>{row.place || "Unknown location"}</div>
          <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {row.hotelHref && (
              <a href={row.hotelHref} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--ember-ink)", fontWeight: 600 }}>Our page ↗</a>
            )}
            <a href={row.stay22} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--ember-ink)", fontWeight: 600 }}>Check availability ↗</a>
            {row.website ? (
              <a href={row.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--ember-ink)", fontWeight: 600 }}>Stored website ↗</a>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>No stored website</span>
            )}
          </div>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: verdictColor(row.autoVerdict) }}>{row.autoVerdict || "NO VERDICT"}</span>
            {row.autoConfidence != null && <span style={{ color: "var(--muted)" }}> · {Math.round(row.autoConfidence * 100)}% confidence</span>}
            {row.autoEvidence && <div style={{ color: "var(--muted)", marginTop: 2 }}>{row.autoEvidence}</div>}
          </div>
        </div>
        <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => go("verified")} disabled={!!busy} style={btn("var(--sage)", "#fff")}>{busy === "verified" ? "..." : "Verified"}</button>
          <button onClick={() => go("wrong_link")} disabled={!!busy} style={btn("var(--gold)", "#16201C")}>{busy === "wrong_link" ? "..." : "Wrong link"}</button>
          <button onClick={() => go("delist")} disabled={!!busy} style={btn("#c0392b", "#fff")}>{busy === "delist" ? "..." : "Delist"}</button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyBoard({
  initialRows, initialTotal, counts: initialCounts, initialVerdict, initialStatus,
}: {
  initialRows: VerifyRow[]; initialTotal: number; counts: VerifyCounts; initialVerdict: string; initialStatus: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [counts, setCounts] = useState(initialCounts);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const next = page + 1;
      const r = await fetch(`/api/admin/hotel-verifications/list?page=${next}&verdict=${encodeURIComponent(initialVerdict)}&status=${encodeURIComponent(initialStatus)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed to load");
      setRows((prev) => [...prev, ...data.rows]);
      setTotal(data.total);
      setCounts(data.counts);
      setPage(next);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  async function onDecide(hotelId: string, decision: "verified" | "wrong_link" | "delist") {
    setError(null);
    try {
      const r = await fetch("/api/admin/hotel-verifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hotel_id: hotelId, decision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed to save");
      const newStatus = data.founder_status as keyof VerifyCounts;
      const oldStatus = (rows.find((x) => x.hotelId === hotelId)?.founderStatus || "pending") as keyof VerifyCounts;

      // Recompute counts locally (cheap) instead of a round trip: the row moves from its old
      // bucket to the new one.
      setCounts((c) => ({ ...c, [oldStatus]: Math.max(0, (c[oldStatus] || 0) - 1), [newStatus]: (c[newStatus] || 0) + 1 }));

      // The default (and most common) filter is status=pending: a decided row no longer belongs.
      if (initialStatus !== "ALL" && initialStatus !== newStatus) {
        setTotal((t) => Math.max(0, t - 1));
        setRows((prev) => prev.filter((x) => x.hotelId !== hotelId));
      } else {
        setRows((prev) => prev.map((x) => (x.hotelId === hotelId ? { ...x, founderStatus: newStatus } : x)));
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    }
  }

  const verdictHref = (v: string) => `/growth/verify?verdict=${encodeURIComponent(v)}&status=${encodeURIComponent(initialStatus)}`;
  const statusHref = (s: string) => `/growth/verify?verdict=${encodeURIComponent(initialVerdict)}&status=${encodeURIComponent(s)}`;

  return (
    <div>
      <Progress counts={counts} />

      <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {STATUS_TABS.map((s) => <Tab key={s} label={s === "ALL" ? "All statuses" : s} active={initialStatus === s} href={statusHref(s)} />)}
      </div>
      <div style={{ marginBottom: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {VERDICT_TABS.map((v) => <Tab key={v} label={v === "ALL" ? "All verdicts" : v} active={initialVerdict === v} href={verdictHref(v)} />)}
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12.5, marginBottom: 10 }}>
        Showing {rows.length.toLocaleString()} of {total.toLocaleString()} matching this filter.
      </p>

      {error && <p style={{ color: "#c0392b", fontSize: 12.5, marginBottom: 10 }}>{error}</p>}

      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nothing matches this filter. Good.</p>
      ) : (
        rows.map((row) => <Row key={row.hotelId} row={row} onDecide={onDecide} />)
      )}

      {rows.length < total && (
        <button
          onClick={loadMore}
          disabled={loading}
          style={{ display: "block", margin: "12px auto 0", border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Loading..." : `Load ${Math.min(50, total - rows.length)} more`}
        </button>
      )}
    </div>
  );
}

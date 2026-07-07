"use client";
// /growth/data-brief board — each target: the personalized, ready-to-send email (copy buttons +
// mailto where a verified address exists), the one-line "why them", contact route, and a local
// send-status tracker (localStorage only; sends are manual by Per from Zoho — see CAMPAIGN.rules).
import { useEffect, useState } from "react";
import { CAMPAIGN, TARGETS, type BriefTarget } from "@/data/dataBriefCampaign";

type Status = "queued" | "sent" | "replied" | "skip";
const STATUSES: Status[] = ["queued", "sent", "replied", "skip"];
const LS_KEY = `brief-status:${CAMPAIGN.id}`;

function buildBody(t: BriefTarget) {
  return CAMPAIGN.bodyTemplate.replace("{FIRST}", t.first).replace("{PERSONAL}", t.personal);
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="rounded-lg px-2.5 py-1 text-xs"
      style={{ border: "1px solid var(--line)", color: "var(--foreground)", background: done ? "var(--sage)" : "var(--card)", ...(done ? { color: "#fff" } : {}) }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch {}
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

export default function DataBriefBoard() {
  const [status, setStatus] = useState<Record<number, Status>>({});
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setStatus(JSON.parse(raw)); } catch {}
  }, []);
  const set = (rank: number, s: Status) => {
    const next = { ...status, [rank]: s };
    setStatus(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
  };
  const sent = Object.values(status).filter((s) => s === "sent" || s === "replied").length;

  return (
    <div>
      {/* Rules + campaign header */}
      <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <div className="text-sm font-semibold mb-1">Send rules (non-negotiable)</div>
        <ul className="text-sm space-y-1" style={{ color: "var(--muted)" }}>
          {CAMPAIGN.rules.map((r) => (<li key={r.slice(0, 24)}>• {r}</li>))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyBtn text={CAMPAIGN.subject} label="Copy subject" />
          <span className="text-xs" style={{ color: "var(--muted)" }}>Subject: {CAMPAIGN.subject}</span>
        </div>
        <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>Progress: {sent}/{TARGETS.length} sent · landing: <a className="underline" href={CAMPAIGN.landing} target="_blank" rel="noopener">{CAMPAIGN.landing}</a></div>
      </div>

      {TARGETS.map((t) => {
        const body = buildBody(t);
        const st = status[t.rank] || "queued";
        const mailto = t.email
          ? `mailto:${t.email}?subject=${encodeURIComponent(CAMPAIGN.subject)}&body=${encodeURIComponent(body)}`
          : null;
        return (
          <div key={t.rank} className="rounded-2xl border p-4 mb-4" style={{ borderColor: st === "sent" || st === "replied" ? "var(--sage)" : "var(--line)", background: "var(--card)", opacity: st === "skip" ? 0.55 : 1 }}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-bold" style={{ color: "var(--muted)" }}>#{t.rank}</span>
              <a className="font-semibold underline" href={t.url} target="_blank" rel="noopener">{t.name}</a>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{t.activity}</span>
              <span className="ml-auto flex gap-1">
                {STATUSES.map((s) => (
                  <button key={s} onClick={() => set(t.rank, s)} className="rounded-md px-2 py-0.5 text-xs" style={{ border: "1px solid var(--line)", background: st === s ? "var(--ember)" : "transparent", color: st === s ? "#16201C" : "var(--muted)" }}>{s}</button>
                ))}
              </span>
            </div>
            <div className="mt-1.5 text-sm" style={{ color: "var(--muted)" }}>{t.what}</div>
            <div className="mt-1.5 text-sm"><strong>Why them:</strong> {t.personal}</div>
            <div className="mt-1.5 text-sm"><strong>Contact:</strong> {t.email ? <a className="underline" href={`mailto:${t.email}`}>{t.email}</a> : t.route}{t.email ? ` · ${t.route}` : ""}</div>
            {t.flag && (
              <div className="mt-1.5 text-sm rounded-lg px-2.5 py-1.5" style={{ background: "color-mix(in oklab, var(--ember) 14%, transparent)", color: "var(--foreground)" }}>⚠ {t.flag}</div>
            )}
            <details className="mt-2.5">
              <summary className="cursor-pointer text-sm" style={{ color: "var(--muted)" }}>Preview email</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border p-3 text-[13px] leading-relaxed" style={{ borderColor: "var(--line)", fontFamily: "inherit" }}>{body}</pre>
            </details>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <CopyBtn text={body} label="Copy body" />
              <CopyBtn text={CAMPAIGN.subject} label="Copy subject" />
              {mailto && (
                <a className="rounded-lg px-2.5 py-1 text-xs no-underline" style={{ border: "1px solid var(--line)", background: "var(--ember)", color: "#16201C" }} href={mailto}>Open in mail app</a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

export type Candidate = {
  hotelId: string;
  name: string;
  city: string;
  country: string;
  score: number;
  confidence: string;
  signals: string[];
  description: string;
  photo: string;
  website: string;
  link: string;
  issues: string[];
  graded: boolean;
};

type Stats = { total: number; agreement: number | null; linkAccuracy: number | null; moe: number | null; mae: number | null; surfaced: number };
type Verdict = "good" | "too_high" | "too_low" | "unsure";

const C = { ember: "#E08A4B", card: "#16201A", line: "#243029", muted: "#9DA89F", good: "#5FBF77", bad: "#E0654B", blue: "#7FB4FF" };
const REASONS: Array<{ key: string; label: string }> = [
  { key: "not_cosy", label: "not cosy" },
  { key: "photos_oversell", label: "photos oversell" },
  { key: "data_thin", label: "data too thin" },
  { key: "wrong_location", label: "wrong location" },
  { key: "gem", label: "hidden gem" },
  { key: "corporate", label: "corporate/chain" },
];

export default function Grader({ queue, stats }: { queue: Candidate[]; stats: Stats }) {
  const [i, setI] = useState(0);
  const [linkOk, setLinkOk] = useState<boolean | null>(null);
  const [reasons, setReasons] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<null | "too_high" | "too_low">(null); // awaiting a target score
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [, setHistory] = useState<number[]>([]);

  const cur = queue[i];
  const ungradedCount = useMemo(() => queue.filter((c) => !c.graded).length, [queue]);

  const reset = useCallback(() => { setLinkOk(null); setReasons(new Set()); setPending(null); }, []);

  // Optimistic: advance the UI immediately, save in the background. Never block grading on
  // the network — the label is re-gradable and a hung request must not freeze the queue.
  const submit = useCallback((verdict: Verdict, humanScore: number | null, linkOverride?: boolean) => {
    if (!cur) return;
    const payload = {
      hotelId: cur.hotelId, cosy_verdict: verdict, human_score: humanScore,
      reasons: [...reasons], link_ok: linkOverride ?? linkOk, ai_score: cur.score, ai_confidence: cur.confidence,
    };
    fetch("/api/grade", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      .then((r) => { if (!r.ok) setFailed((f) => f + 1); })
      .catch(() => setFailed((f) => f + 1));
    setHistory((h) => [...h, i]);
    setDone((d) => d + 1);
    reset();
    setI((x) => Math.min(x + 1, queue.length));
  }, [cur, reasons, linkOk, i, queue.length, reset]);

  const onVerdict = useCallback((v: Verdict) => {
    if (v === "too_high" || v === "too_low") setPending(v); // reveal score picker
    else submit(v, null);
  }, [submit]);

  // Wrong link = mislinked listing, nothing cosy to rate → log it and skip to the next.
  const markLinkWrong = useCallback(() => submit("unsure", null, false), [submit]);

  const toggleReason = useCallback((k: string) => {
    setReasons((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => { if (!h.length) return h; setI(h[h.length - 1]); setDone((d) => Math.max(0, d - 1)); reset(); return h.slice(0, -1); });
  }, [reset]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (pending) { // score-picker mode: digits set the corrected score
        if (/^[0-9]$/.test(e.key)) submit(pending, Number(e.key));
        else if (e.key === "!") submit(pending, 10);
        else if (e.key === "Enter") submit(pending, null);
        else if (k === "z") setPending(null);
        return;
      }
      if (e.key === "1" || k === "g") onVerdict("good");
      else if (e.key === "2") onVerdict("too_high");
      else if (e.key === "3") onVerdict("too_low");
      else if (e.key === "4" || k === "u") onVerdict("unsure");
      else if (k === "k") markLinkWrong();
      else if (k === "j") setLinkOk(true);
      else if (k === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onVerdict, submit, undo]);

  const liveTotal = stats.total + done;
  const moe = liveTotal ? Math.round(196 * Math.sqrt(0.25 / liveTotal)) / 10 : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Grade cosiness</h1>
        <div style={{ fontSize: 12, color: C.muted }}>
          {liveTotal} graded · ±{moe ?? "—"}%{stats.agreement != null && <> · {stats.agreement}% agree</>}
          {stats.mae != null && <> · {stats.mae} avg miss</>}{stats.linkAccuracy != null && <> · {stats.linkAccuracy}% links ok</>}
          {failed > 0 && <span style={{ color: C.bad }}> · {failed} save{failed > 1 ? "s" : ""} failed</span>}
        </div>
      </div>
      <Bar done={liveTotal} target={150} />
      <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 14px" }}>
        {ungradedCount} ungraded (borderline & flagged first). <b>1</b> right · <b>2</b> too high · <b>3</b> too low · <b>4</b> unsure · <b>j</b> link ok · <b>k</b> link wrong → skip · <b>z</b> undo. On too high/low, tap or type the score you&apos;d give (<b>!</b>=10, Enter=skip).
      </p>

      {!cur ? (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 16 }}>Queue complete — {liveTotal} graded. 🎉</p>
          <p style={{ color: C.muted, fontSize: 13 }}>Refresh for the next batch. Your labels already feed the score.</p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
          {cur.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.photo} alt={cur.name} style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, background: "#0d120f" }}>no vetted photo — judge on data only</div>
          )}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{cur.name || "(unnamed)"}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{[cur.city, cur.country].filter(Boolean).join(", ")} · confidence {cur.confidence}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ember, lineHeight: 1 }}>{cur.score.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: C.muted }}>AI cosy</div>
              </div>
            </div>

            {cur.description && <p style={{ fontSize: 14, lineHeight: 1.5, margin: "10px 0 8px" }}>{cur.description}</p>}
            {cur.signals.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {cur.signals.map((s, k) => <span key={k} style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" }}>{s}</span>)}
              </div>
            )}
            {cur.issues.length > 0 && (
              <div style={{ fontSize: 12, color: C.bad, marginBottom: 8 }}>
                ⚠ {cur.issues.map((x) => x === "rating_name_only" ? "scored on name only — no real data" : x === "geo_outside_city" ? "coordinates fall outside the named city" : x).join(" · ")}
              </div>
            )}

            {/* Reason chips — the "why", optional, taps before verdict */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
              {REASONS.map((r) => (
                <button key={r.key} onClick={() => toggleReason(r.key)} style={chip(reasons.has(r.key))}>{r.label}</button>
              ))}
            </div>

            {/* Link check */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0", flexWrap: "wrap" }}>
              <a href={cur.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.blue, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px" }}>Check link ↗</a>
              <button onClick={() => setLinkOk(true)} style={pill(linkOk === true, C.good)}>link right (j)</button>
              <button onClick={markLinkWrong} style={pill(linkOk === false, C.bad)}>link wrong → skip (k)</button>
            </div>

            {/* Verdict, or the corrected-score picker when too high/low is pending */}
            {pending ? (
              <div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>
                  Marked <b style={{ color: pending === "too_high" ? C.ember : C.blue }}>{pending === "too_high" ? "too high" : "too low"}</b> — what would YOU score it?
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button key={n} onClick={() => submit(pending, n)} style={{ background: "transparent", color: C.ember, border: `1.5px solid ${C.ember}`, borderRadius: 8, padding: "12px 0", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{n}</button>
                  ))}
                  <button onClick={() => submit(pending, null)} style={{ background: "transparent", color: C.muted, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 0", fontSize: 13, cursor: "pointer" }}>skip</button>
                </div>
                <button onClick={() => setPending(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, marginTop: 8 }}>↶ back (z)</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <Vbtn label="Right (1)" color={C.good} onClick={() => onVerdict("good")} />
                <Vbtn label="Too high (2)" color={C.ember} onClick={() => onVerdict("too_high")} />
                <Vbtn label="Too low (3)" color={C.blue} onClick={() => onVerdict("too_low")} />
                <Vbtn label="Unsure (4)" color={C.muted} onClick={() => onVerdict("unsure")} />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: C.muted }}>
              <span>{i + 1} / {queue.length}{cur.graded && " · already graded"}</span>
              <button onClick={undo} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12 }}>↶ undo (z)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Vbtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", color, border: `1.5px solid ${color}`, borderRadius: 10, padding: "12px 8px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{label}</button>
  );
}
function pill(active: boolean, color: string): React.CSSProperties {
  return { background: active ? color : "transparent", color: active ? "#0F1512" : color, border: `1px solid ${color}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
}
function chip(active: boolean): React.CSSProperties {
  return { background: active ? C.muted : "transparent", color: active ? "#0F1512" : C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "5px 11px", fontSize: 12, cursor: "pointer" };
}
function Bar({ done, target }: { done: number; target: number }) {
  const pct = Math.min(100, Math.round((done / target) * 100));
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.ember }} />
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{done} / {target} toward a solid confidence read</div>
    </div>
  );
}

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

type Stats = { total: number; agreement: number | null; linkAccuracy: number | null; moe: number | null; surfaced: number };
type Verdict = "good" | "too_high" | "too_low" | "unsure";

const C = { ember: "#E08A4B", card: "#16201A", line: "#243029", muted: "#9DA89F", good: "#5FBF77", bad: "#E0654B" };

export default function Grader({ queue, stats }: { queue: Candidate[]; stats: Stats }) {
  const [i, setI] = useState(0);
  const [linkOk, setLinkOk] = useState<boolean | null>(null);
  const [done, setDone] = useState(0); // graded this session
  const [history, setHistory] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const cur = queue[i];
  const ungradedCount = useMemo(() => queue.filter((c) => !c.graded).length, [queue]);

  const submit = useCallback(async (verdict: Verdict) => {
    if (!cur || saving) return;
    setSaving(true);
    try {
      await fetch("/api/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hotelId: cur.hotelId, cosy_verdict: verdict, link_ok: linkOk,
          ai_score: cur.score, ai_confidence: cur.confidence,
        }),
      });
    } catch { /* keep moving; the label can be re-graded */ }
    setSaving(false);
    setHistory((h) => [...h, i]);
    setDone((d) => d + 1);
    setLinkOk(null);
    setI((x) => Math.min(x + 1, queue.length));
  }, [cur, saving, linkOk, i, queue.length]);

  const undo = useCallback(() => {
    setHistory((h) => { if (!h.length) return h; setI(h[h.length - 1]); setDone((d) => Math.max(0, d - 1)); setLinkOk(null); return h.slice(0, -1); });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "1" || e.key.toLowerCase() === "g") submit("good");
      else if (e.key === "2") submit("too_high");
      else if (e.key === "3") submit("too_low");
      else if (e.key === "4" || e.key.toLowerCase() === "u") submit("unsure");
      else if (e.key.toLowerCase() === "k") setLinkOk(false);
      else if (e.key === "[" || e.key.toLowerCase() === "j") setLinkOk(true);
      else if (e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit, undo]);

  const liveTotal = stats.total + done;
  const moe = liveTotal ? Math.round(196 * Math.sqrt(0.25 / liveTotal)) / 10 : null;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Grade cosiness</h1>
        <div style={{ fontSize: 12, color: C.muted }}>
          {liveTotal} graded · ±{moe ?? "—"}% margin{stats.agreement != null && <> · {stats.agreement}% agree</>}
          {stats.linkAccuracy != null && <> · {stats.linkAccuracy}% links ok</>}
        </div>
      </div>
      <Bar done={liveTotal} target={150} />
      <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 16px" }}>
        {ungradedCount} ungraded in queue (borderline & flagged first). Keys: <b>1</b> right · <b>2</b> too high · <b>3</b> too low · <b>4</b> unsure · <b>k</b> link wrong · <b>j</b> link ok · <b>z</b> undo.
      </p>

      {!cur ? (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 16 }}>Queue complete — {liveTotal} graded this set. 🎉</p>
          <p style={{ color: C.muted, fontSize: 13 }}>Refresh to pull the next batch, or stop here. Your labels are already feeding the score.</p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
          {cur.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.photo} alt={cur.name} style={{ width: "100%", height: 300, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, background: "#0d120f" }}>no vetted photo — judge on data only</div>
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

            {/* Link check — verify it points at the right hotel */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
              <a href={cur.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#7FB4FF", textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px" }}>Check link ↗</a>
              <button onClick={() => setLinkOk(true)} style={pill(linkOk === true, C.good)}>link right (j)</button>
              <button onClick={() => setLinkOk(false)} style={pill(linkOk === false, C.bad)}>link wrong (k)</button>
            </div>

            {/* Cosy verdict — the primary action; advances on click */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 6 }}>
              <Vbtn label="Right (1)" color={C.good} onClick={() => submit("good")} disabled={saving} />
              <Vbtn label="Too high (2)" color={C.ember} onClick={() => submit("too_high")} disabled={saving} />
              <Vbtn label="Too low (3)" color="#7FB4FF" onClick={() => submit("too_low")} disabled={saving} />
              <Vbtn label="Unsure (4)" color={C.muted} onClick={() => submit("unsure")} disabled={saving} />
            </div>
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

function Vbtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ background: "transparent", color, border: `1.5px solid ${color}`, borderRadius: 10, padding: "12px 8px", fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {label}
    </button>
  );
}

function pill(active: boolean, color: string): React.CSSProperties {
  return { background: active ? color : "transparent", color: active ? "#0F1512" : color, border: `1px solid ${color}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
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

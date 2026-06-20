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
type Link = "ok" | "wrong" | null;

const C = { ember: "#E08A4B", card: "#16201A", line: "#243029", muted: "#9DA89F", good: "#5FBF77", bad: "#E0654B", blue: "#7FB4FF", ink: "#0F1512" };
const REASONS: Array<{ key: string; label: string }> = [
  { key: "not_cosy", label: "not cosy" }, { key: "photos_oversell", label: "photos oversell" },
  { key: "data_thin", label: "data too thin" }, { key: "wrong_location", label: "wrong location" },
  { key: "gem", label: "hidden gem" }, { key: "corporate", label: "corporate/chain" },
];

export default function Grader({ queue, stats }: { queue: Candidate[]; stats: Stats }) {
  const [i, setI] = useState(0);
  const [link, setLink] = useState<Link>(null);
  const [cosy, setCosy] = useState<Verdict | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [reasons, setReasons] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [, setHistory] = useState<number[]>([]);

  const cur = queue[i];
  const ungraded = useMemo(() => queue.filter((c) => !c.graded).length, [queue]);

  const resetCard = useCallback(() => { setLink(null); setCosy(null); setScore(null); setReasons(new Set()); }, []);

  // A card is complete when the link is checked AND (the link is wrong → nothing to rate,
  // or the cosy verdict is set, and if it's too high/low a corrected score is chosen).
  const complete = (l: Link, c: Verdict | null, s: number | null) =>
    l === "wrong" || (l === "ok" && c != null && (c === "good" || c === "unsure" || s != null));

  const save = useCallback((l: Link, c: Verdict | null, s: number | null, rs: Set<string>) => {
    if (!cur) return;
    const verdict: Verdict = l === "wrong" ? "unsure" : (c ?? "unsure");
    fetch("/api/grade", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ hotelId: cur.hotelId, cosy_verdict: verdict, human_score: s, reasons: [...rs], link_ok: l === "ok" ? true : l === "wrong" ? false : null, ai_score: cur.score, ai_confidence: cur.confidence }),
    }).then((r) => { if (!r.ok) setFailed((f) => f + 1); }).catch(() => setFailed((f) => f + 1));
    setHistory((h) => [...h, i]);
    setDone((d) => d + 1);
    resetCard();
    setI((x) => Math.min(x + 1, queue.length));
  }, [cur, i, queue.length, resetCard]);

  // Apply a state change and auto-advance the moment the card becomes complete.
  const applyLink = useCallback((l: Link) => {
    if (complete(l, cosy, score)) save(l, cosy, score, reasons); else setLink(l);
  }, [cosy, score, reasons, save]);
  const applyCosy = useCallback((c: Verdict) => {
    if (c === "too_high" || c === "too_low") { setCosy(c); setScore(null); return; } // wait for score
    if (complete(link, c, null)) save(link, c, null, reasons); else setCosy(c);
  }, [link, reasons, save]);
  const applyScore = useCallback((n: number) => {
    if (complete(link, cosy, n)) save(link, cosy, n, reasons); else setScore(n);
  }, [link, cosy, reasons, save]);

  const toggleReason = useCallback((k: string) => setReasons((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; }), []);
  const undo = useCallback(() => setHistory((h) => { if (!h.length) return h; setI(h[h.length - 1]); setDone((d) => Math.max(0, d - 1)); resetCard(); return h.slice(0, -1); }), [resetCard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((cosy === "too_high" || cosy === "too_low") && /^[0-9]$/.test(e.key)) { applyScore(Number(e.key)); return; }
      if ((cosy === "too_high" || cosy === "too_low") && e.key === "!") { applyScore(10); return; }
      if (k === "j") applyLink("ok");
      else if (k === "k") applyLink("wrong");
      else if (e.key === "1" || k === "g") applyCosy("good");
      else if (e.key === "2") applyCosy("too_high");
      else if (e.key === "3") applyCosy("too_low");
      else if (e.key === "4" || k === "u") applyCosy("unsure");
      else if (k === "z") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cosy, applyLink, applyCosy, applyScore, undo]);

  const liveTotal = stats.total + done;
  const moe = liveTotal ? Math.round(196 * Math.sqrt(0.25 / liveTotal)) / 10 : null;
  const linkDone = link != null;
  const ratingDone = link === "wrong" || (cosy != null && (cosy === "good" || cosy === "unsure" || score != null));
  const needScore = cosy === "too_high" || cosy === "too_low";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Grade cosiness</h1>
        <div style={{ fontSize: 12, color: C.muted }}>
          {liveTotal} graded · ±{moe ?? "—"}%{stats.agreement != null && <> · {stats.agreement}% agree</>}
          {stats.mae != null && <> · {stats.mae} avg miss</>}{stats.linkAccuracy != null && <> · {stats.linkAccuracy}% links ok</>}
          {failed > 0 && <span style={{ color: C.bad }}> · {failed} failed</span>}
        </div>
      </div>
      <Bar done={liveTotal} target={150} />
      <p style={{ fontSize: 12, color: C.muted, margin: "6px 0 14px" }}>{ungraded} ungraded (borderline & flagged first). Answer both steps and the card advances automatically. <b>z</b> = undo.</p>

      {!cur ? (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 16 }}>Queue complete — {liveTotal} graded. 🎉</p>
          <p style={{ color: C.muted, fontSize: 13 }}>Refresh for the next batch.</p>
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
          {cur.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.photo} alt={cur.name} style={{ width: "100%", height: 280, objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 13, background: "#0d120f" }}>no vetted photo — judge on data only</div>
          )}
          <div style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 19, fontWeight: 700 }}>{cur.name || "(unnamed)"}</div>
                <div style={{ color: C.muted, fontSize: 13 }}>{[cur.city, cur.country].filter(Boolean).join(", ")} · confidence {cur.confidence}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: C.ember, lineHeight: 1 }}>{cur.score.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: C.muted }}>AI cosy</div>
              </div>
            </div>
            {cur.description && <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: "8px 0 6px", color: "#D7CFC3" }}>{cur.description}</p>}
            {cur.signals.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                {cur.signals.map((s, k) => <span key={k} style={{ fontSize: 11, color: C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" }}>{s}</span>)}
              </div>
            )}
            {cur.issues.length > 0 && <div style={{ fontSize: 12, color: C.bad, marginBottom: 4 }}>⚠ {cur.issues.map((x) => x === "rating_name_only" ? "scored on name only" : x === "geo_outside_city" ? "coords outside city" : x).join(" · ")}</div>}

            {/* STEP 1 — link */}
            <Step n="1" label="Right hotel & correct link?" done={linkDone}>
              <a href={cur.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.blue, textDecoration: "none", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 12px" }}>Open link ↗</a>
              <Choice active={link === "ok"} color={C.good} onClick={() => applyLink("ok")}>✓ Correct (j)</Choice>
              <Choice active={link === "wrong"} color={C.bad} onClick={() => applyLink("wrong")}>✗ Wrong link → skip (k)</Choice>
            </Step>

            {/* STEP 2 — rating (disabled if link wrong) */}
            <Step n="2" label="Is the cosy score right?" done={ratingDone} disabled={link === "wrong"}>
              {link === "wrong" ? (
                <span style={{ fontSize: 13, color: C.muted }}>Skipped — can&apos;t rate a mislinked hotel.</span>
              ) : (
                <>
                  <Choice active={cosy === "good"} color={C.good} onClick={() => applyCosy("good")}>Right (1)</Choice>
                  <Choice active={cosy === "too_high"} color={C.ember} onClick={() => applyCosy("too_high")}>Too high (2)</Choice>
                  <Choice active={cosy === "too_low"} color={C.blue} onClick={() => applyCosy("too_low")}>Too low (3)</Choice>
                  <Choice active={cosy === "unsure"} color={C.muted} onClick={() => applyCosy("unsure")}>Unsure (4)</Choice>
                </>
              )}
            </Step>
            {needScore && (
              <div style={{ margin: "0 0 4px 26px" }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 5 }}>What would you score it? (type 0–9, <b>!</b>=10)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 5 }}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <button key={n} onClick={() => applyScore(n)} style={{ background: score === n ? C.ember : "transparent", color: score === n ? C.ink : C.ember, border: `1.5px solid ${C.ember}`, borderRadius: 7, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{n}</button>
                  ))}
                </div>
              </div>
            )}

            {/* optional reasons */}
            {link !== "wrong" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 2px 26px" }}>
                <span style={{ fontSize: 11, color: C.muted, alignSelf: "center" }}>why (optional):</span>
                {REASONS.map((r) => <button key={r.key} onClick={() => toggleReason(r.key)} style={chip(reasons.has(r.key))}>{r.label}</button>)}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
              <div style={{ fontSize: 12, color: C.muted }}>
                <Tick on={linkDone} /> link &nbsp; <Tick on={ratingDone} /> rating &nbsp;
                <span style={{ color: linkDone && ratingDone ? C.good : C.muted }}>{linkDone && ratingDone ? "complete → advancing" : "answer both to continue"}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {i + 1}/{queue.length} · <button onClick={undo} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12 }}>↶ undo (z)</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, label, done, disabled, children }: { n: string; label: string; done: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, opacity: disabled ? 0.55 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
        <span style={{ width: 18, height: 18, borderRadius: 999, background: done ? C.good : "transparent", border: `1.5px solid ${done ? C.good : C.muted}`, color: C.ink, fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{done ? "✓" : n}</span>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginLeft: 26 }}>{children}</div>
    </div>
  );
}
function Choice({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ background: active ? color : "transparent", color: active ? C.ink : color, border: `1.5px solid ${color}`, borderRadius: 9, padding: "9px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>{children}</button>;
}
function Tick({ on }: { on: boolean }) { return <span style={{ color: on ? C.good : C.muted, fontWeight: 800 }}>{on ? "☑" : "☐"}</span>; }
function chip(active: boolean): React.CSSProperties {
  return { background: active ? C.muted : "transparent", color: active ? C.ink : C.muted, border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 11.5, cursor: "pointer" };
}
function Bar({ done, target }: { done: number; target: number }) {
  const pct = Math.min(100, Math.round((done / target) * 100));
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: C.ember }} /></div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{done} / {target} toward a solid confidence read</div>
    </div>
  );
}

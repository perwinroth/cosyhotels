"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Card = { hotelId: string; name: string; city: string; photo: string };
const C = { ember: "#E08A4B", card: "#16201A", line: "#243029", muted: "#9DA89F", good: "#5FBF77", bad: "#E0654B", ink: "#0F1512" };

export default function RateSwipe({ cards, rater }: { cards: Card[]; rater?: string | null }) {
  const [name, setName] = useState<string | null>(rater || null);
  const [nameInput, setNameInput] = useState("");
  const [i, setI] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startX = useRef<number | null>(null);

  // A ?as= name appendix wins; otherwise fall back to a previously saved local name.
  useEffect(() => { if (rater) { try { localStorage.setItem("cosy_rater", rater); } catch {} return; } try { const n = localStorage.getItem("cosy_rater"); if (n) setName(n); } catch {} }, [rater]);

  const cur = cards[i];
  const commit = useCallback((vote: boolean) => {
    if (!cur || !name || exiting) return;
    fetch("/api/vote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hotelId: cur.hotelId, grader: name, vote }) }).catch(() => {});
    setDragX(vote ? 700 : -700); setExiting(true);
    window.setTimeout(() => { setExiting(false); setDragX(0); setI((x) => x + 1); }, 200);
  }, [cur, name, exiting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") commit(true); else if (e.key === "ArrowLeft") commit(false); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  const onDown = (e: React.PointerEvent) => { if (exiting) return; startX.current = e.clientX; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (startX.current == null) return; setDragX(e.clientX - startX.current); };
  const onUp = () => { if (startX.current == null) return; const dx = dragX; startX.current = null; if (dx > 110) commit(true); else if (dx < -110) commit(false); else setDragX(0); };

  // --- name gate ---
  if (name == null) {
    return (
      <div style={{ paddingTop: 60, textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🔥</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "12px 0 6px" }}>Which hotels feel cosy?</h1>
        <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.5, margin: "0 auto 22px", maxWidth: 320 }}>
          {cards.length} hotels, ~2 minutes. Swipe right if it looks cosy, left if it doesn&apos;t. Go with your gut — there&apos;s no wrong answer.
        </p>
        <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Your name" autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && nameInput.trim()) { const n = nameInput.trim().toLowerCase(); localStorage.setItem("cosy_rater", n); setName(n); } }}
          style={{ width: "100%", maxWidth: 280, padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: "#F3EEE6", fontSize: 16, textAlign: "center" }} />
        <div>
          <button onClick={() => { if (nameInput.trim()) { const n = nameInput.trim().toLowerCase(); localStorage.setItem("cosy_rater", n); setName(n); } }}
            style={{ marginTop: 16, padding: "12px 28px", borderRadius: 10, border: "none", background: C.ember, color: C.ink, fontSize: 16, fontWeight: 700, cursor: "pointer" }}>Start</button>
        </div>
      </div>
    );
  }

  // --- done ---
  if (!cur) {
    return (
      <div style={{ paddingTop: 80, textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "12px 0 6px" }}>All done — thank you!</h1>
        <p style={{ color: C.muted, fontSize: 14 }}>You rated all {cards.length}. That&apos;s a huge help. You can close this.</p>
      </div>
    );
  }

  const rot = dragX / 18;
  const cosyHint = Math.max(0, Math.min(1, dragX / 110));
  const nopeHint = Math.max(0, Math.min(1, -dragX / 110));

  return (
    <div style={{ paddingTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: C.muted }}>Hi {name} 👋</span>
        <span style={{ fontSize: 13, color: C.muted }}>{i + 1} / {cards.length}</span>
      </div>
      <div style={{ height: 5, background: C.line, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ width: `${(i / cards.length) * 100}%`, height: "100%", background: C.ember }} />
      </div>

      {/* card */}
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: "relative", aspectRatio: "3 / 4", borderRadius: 18, overflow: "hidden", background: C.card, border: `1px solid ${C.line}`, touchAction: "none", cursor: "grab", userSelect: "none",
          transform: `translateX(${dragX}px) rotate(${rot}deg)`, transition: exiting || startX.current == null ? "transform .2s ease" : "none" }}>
        {cur.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cur.photo} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>no photo</div>}
        {/* gradient + name */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(15,21,18,.9) 0%, rgba(15,21,18,0) 45%)" }} />
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>{cur.name}</div>
          {cur.city && <div style={{ fontSize: 14, color: "#D7CFC3", marginTop: 2 }}>{cur.city}</div>}
        </div>
        {/* drag hints */}
        <div style={{ position: "absolute", top: 18, left: 18, padding: "6px 12px", border: `3px solid ${C.good}`, color: C.good, borderRadius: 10, fontWeight: 900, fontSize: 22, transform: "rotate(-12deg)", opacity: cosyHint }}>COSY</div>
        <div style={{ position: "absolute", top: 18, right: 18, padding: "6px 12px", border: `3px solid ${C.bad}`, color: C.bad, borderRadius: 10, fontWeight: 900, fontSize: 22, transform: "rotate(12deg)", opacity: nopeHint }}>NOPE</div>
      </div>

      {/* buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 18 }}>
        <button onClick={() => commit(false)} aria-label="Not cosy" style={btn(C.bad)}>✕</button>
        <button onClick={() => commit(true)} aria-label="Cosy" style={btn(C.good)}>♥</button>
      </div>
      <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 14 }}>Swipe or tap · ← not cosy · cosy →</p>
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { width: 66, height: 66, borderRadius: "50%", border: `2px solid ${color}`, background: "transparent", color, fontSize: 26, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
}

"use client";
// Shared kanban board core for the /growth dashboard. Phone-first: every card shows one full-width
// "advance to the next stage" tap target plus a compact ⋯ menu (native <details>, keyboard-friendly)
// listing every other legal stage, incl. discard. Moves are optimistic — the card jumps columns at
// once and snaps back with an inline error chip if the POST fails (no alert() — dialogs break
// automation). Desktop adds hand-rolled HTML5 drag-and-drop over the same move path. All colour comes
// from the theme CSS vars so both Boutique-Nocturne (dark) and Warm-Paper (light) render correctly.
import { ReactNode, useState } from "react";

export type Chip = { label: string; color?: string; bg?: string; title?: string };

export type KanbanCard = {
  id: string;
  status: string;
  title: string;
  href?: string;
  subtitle?: string;
  chips?: Chip[];
  body?: ReactNode;
  sortKey?: number; // lower sorts first within a column
};

export type KanbanColumn = {
  id: string; // the status value written to the DB
  title: string;
  hint?: string; // shown when the column is empty
  advanceLabel?: string; // primary-button label for cards landing here ("Mark contacted")
  discard?: boolean; // Declined / Dismissed — collapsed behind a footer strip
};

export type KanbanProps = {
  columns: KanbanColumn[];
  cards: KanbanCard[];
  onMove: (cardId: string, toStatus: string) => Promise<boolean>;
};

const CSS = `
.gk-board{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;-webkit-overflow-scrolling:touch;}
.gk-col{flex:0 0 85vw;scroll-snap-align:start;background:var(--surface-2);border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:10px;}
.gk-col--over{outline:2px dashed var(--sage);outline-offset:-2px;}
@media(min-width:768px){.gk-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);overflow:visible;}.gk-col{flex:none;}}
.gk-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:11px 12px;display:flex;flex-direction:column;gap:7px;cursor:grab;}
.gk-card:focus-visible{outline:2px solid var(--sage);outline-offset:1px;}
.gk-card--moved{animation:gk-pop .28s ease;}
@keyframes gk-pop{from{opacity:.35;transform:translateY(-5px);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.gk-card--moved{animation:none;}}
.gk-adv{width:100%;text-align:center;border:none;border-radius:8px;padding:8px 10px;font-size:13px;font-weight:700;background:var(--sage);color:#fff;cursor:pointer;}
.gk-menu{position:relative;}
.gk-menu>summary{list-style:none;cursor:pointer;user-select:none;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:16px;font-weight:700;}
.gk-menu>summary::-webkit-details-marker{display:none;}
.gk-menu[open]>summary{color:var(--foreground);}
.gk-pop{position:absolute;right:0;top:38px;z-index:30;min-width:170px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:5px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:2px;}
.gk-pop button{text-align:left;background:none;border:none;border-radius:7px;padding:7px 9px;font-size:12.5px;font-weight:600;color:var(--foreground);cursor:pointer;}
.gk-pop button:hover{background:color-mix(in srgb,var(--card) 80%,var(--foreground) 9%);}
.gk-chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600;line-height:1.5;}
`;

export default function Kanban({ columns, cards, onMove }: KanbanProps) {
  // Optimistic status overrides keyed by card id. Card body + data always flow from props (so parent
  // updates — e.g. a blog date input — stay live); only the column a card sits in is overridden here.
  const [override, setOverride] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [moved, setMoved] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [overCol, setOverCol] = useState<string | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);

  const live = columns.filter((c) => !c.discard);
  const discard = columns.filter((c) => c.discard);
  const statusOf = (c: KanbanCard) => override[c.id] ?? c.status;

  const nextColumn = (status: string): KanbanColumn | null => {
    const i = live.findIndex((c) => c.id === status);
    return i >= 0 && i < live.length - 1 ? live[i + 1] : null;
  };

  async function move(cardId: string, toStatus: string) {
    const card = cards.find((c) => c.id === cardId);
    if (!card || statusOf(card) === toStatus) return;
    const prev = statusOf(card);
    setOverride((o) => ({ ...o, [cardId]: toStatus }));
    setErrors((e) => ({ ...e, [cardId]: false }));
    setPending((p) => ({ ...p, [cardId]: true }));
    setMoved(cardId);
    let ok = false;
    try { ok = await onMove(cardId, toStatus); } catch { ok = false; }
    setPending((p) => ({ ...p, [cardId]: false }));
    if (!ok) {
      setOverride((o) => ({ ...o, [cardId]: prev })); // snap back
      setErrors((e) => ({ ...e, [cardId]: true }));
    }
  }

  function renderCard(card: KanbanCard) {
    const status = statusOf(card);
    const next = nextColumn(status);
    const others = columns.filter((c) => c.id !== status);
    return (
      <div
        key={card.id}
        className={`gk-card${moved === card.id ? " gk-card--moved" : ""}`}
        draggable
        tabIndex={0}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", card.id); e.dataTransfer.effectAllowed = "move"; }}
        onAnimationEnd={() => setMoved((m) => (m === card.id ? null : m))}
      >
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
          {card.href
            ? <a href={card.href} target="_blank" rel="noreferrer" style={{ color: "var(--foreground)", textDecoration: "none" }}>{card.title} ↗</a>
            : card.title}
        </div>
        {card.subtitle && <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{card.subtitle}</div>}
        {card.chips && card.chips.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {card.chips.map((ch, i) => (
              <span key={i} className="gk-chip" title={ch.title}
                style={ch.bg ? { background: ch.bg, borderColor: ch.bg, color: ch.color ?? "#fff" } : { color: ch.color ?? "var(--muted)" }}>
                {ch.label}
              </span>
            ))}
          </div>
        )}
        {card.body}
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 1 }}>
          {next ? (
            <button className="gk-adv" disabled={pending[card.id]} onClick={() => move(card.id, next.id)}>
              {next.advanceLabel ?? `Mark ${next.title.toLowerCase()}`} →
            </button>
          ) : <span style={{ flex: 1, fontSize: 11.5, color: "var(--muted)" }}>Final stage</span>}
          <details className="gk-menu">
            <summary aria-label="More stages">⋯</summary>
            <div className="gk-pop">
              {others.map((c) => (
                <button key={c.id} onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open"); move(card.id, c.id); }}>
                  {c.discard ? "Move to " : "Set "}{c.title}
                </button>
              ))}
            </div>
          </details>
        </div>
        {errors[card.id] && (
          <span className="gk-chip" style={{ color: "var(--ember)", borderColor: "var(--ember)" }}>couldn&apos;t save — tap a stage to retry</span>
        )}
      </div>
    );
  }

  function renderColumn(col: KanbanColumn) {
    const inCol = cards
      .filter((c) => statusOf(c) === col.id)
      .sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0) || a.title.localeCompare(b.title));
    return (
      <div
        key={col.id}
        className={`gk-col${overCol === col.id ? " gk-col--over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overCol !== col.id) setOverCol(col.id); }}
        onDragLeave={() => setOverCol((o) => (o === col.id ? null : o))}
        onDrop={(e) => { e.preventDefault(); setOverCol(null); const id = e.dataTransfer.getData("text/plain"); if (id) move(id, col.id); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)" }}>{col.title}</span>
          <span style={{ display: "inline-flex", alignItems: "center", background: "var(--sage)", color: "#fff", borderRadius: 999, minWidth: 20, height: 18, padding: "0 6px", fontSize: 11, fontWeight: 700, justifyContent: "center" }}>{inCol.length}</span>
        </div>
        {inCol.length === 0
          ? <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 2px", lineHeight: 1.5 }}>{col.hint ?? "Nothing here yet."}</p>
          : inCol.map(renderCard)}
      </div>
    );
  }

  const discardCount = cards.filter((c) => discard.some((d) => d.id === statusOf(c))).length;

  return (
    <div>
      <style>{CSS}</style>
      <div className="gk-board">{live.map(renderColumn)}</div>
      {discard.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => setShowDiscard((s) => !s)}
            style={{ background: "none", border: "1px solid var(--line)", borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--muted)", cursor: "pointer" }}>
            {discard.map((d) => d.title).join(" / ")} ({discardCount}) — {showDiscard ? "hide" : "show"}
          </button>
          {showDiscard && <div className="gk-board" style={{ marginTop: 10 }}>{discard.map(renderColumn)}</div>}
        </div>
      )}
    </div>
  );
}

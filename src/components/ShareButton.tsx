"use client";
// Subtle share control. A 36px round outline icon (matches the theme toggle). Mobile → native
// share sheet (Web Share API). Desktop → a compact popover led by Copy link, then the few
// platforms a travel audience actually uses (Pinterest, WhatsApp, X). Defaults to current URL.
import { useEffect, useRef, useState } from "react";

export default function ShareButton({ title, text }: { title?: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setUrl(window.location.href); }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const t = title || (typeof document !== "undefined" ? document.title : "Got Cosy?");
  const onShare = async () => {
    const u = url || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title: t, text: text || t, url: u }); return; } catch { /* cancelled — fall through to popover */ }
    }
    setOpen((o) => !o);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url || window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };

  const e = encodeURIComponent;
  const links = [
    { label: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(t)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${e(`${t} ${url}`)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${e(t)}&url=${e(url)}` },
  ];
  const row: React.CSSProperties = { display: "block", padding: "9px 14px", fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", background: "transparent", border: "none", textAlign: "left", width: "100%", cursor: "pointer" };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={onShare}
        aria-label="Share"
        title="Share"
        aria-haspopup="menu"
        aria-expanded={open}
        className="hov"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}
      >
        {/* universal three-nodes share glyph */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
        </svg>
      </button>
      {open && (
        <div role="menu" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, minWidth: 176, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow)", overflow: "hidden", padding: "4px 0" }}>
          <button className="hov" style={{ ...row, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "space-between" }} onClick={copy}>
            <span>{copied ? "Copied!" : "Copy link"}</span>
            <span style={{ color: copied ? "var(--sage)" : "var(--ember)", fontSize: 12 }}>{copied ? "✓" : "⧉"}</span>
          </button>
          <div style={{ height: 1, background: "var(--line)", margin: "4px 0" }} />
          {links.map((l) => (
            <a key={l.label} className="hov" style={row} href={l.href} target="_blank" rel="noreferrer noopener" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
        </div>
      )}
    </div>
  );
}

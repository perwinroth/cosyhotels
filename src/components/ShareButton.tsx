"use client";
// Share control. Uses the native share sheet (Web Share API) on mobile; falls back to a small
// popover (copy link + X / Facebook / Pinterest / WhatsApp / email) on desktop. Defaults to the
// current page URL, so it just needs a title. Themed via CSS tokens (light/dark aware).
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
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const t = title || (typeof document !== "undefined" ? document.title : "Got Cosy?");
  const onShare = async () => {
    const u = url || (typeof window !== "undefined" ? window.location.href : "");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try { await navigator.share({ title: t, text: text || t, url: u }); return; } catch { /* cancelled — fall through */ }
    }
    setOpen((o) => !o);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url || window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const e = encodeURIComponent;
  const links = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${e(t)}&url=${e(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}` },
    { label: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(t)}` },
    { label: "WhatsApp", href: `https://wa.me/?text=${e(`${t} ${url}`)}` },
    { label: "Email", href: `mailto:?subject=${e(t)}&body=${e(`${t}\n${url}`)}` },
  ];

  const item: React.CSSProperties = { display: "block", padding: "9px 14px", fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", background: "transparent", border: "none", textAlign: "left", width: "100%", cursor: "pointer" };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={onShare}
        aria-label="Share"
        className="hov"
        style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", lineHeight: 1 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
        Share
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 40, minWidth: 168, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 12, boxShadow: "var(--shadow)", overflow: "hidden", padding: "4px 0" }}>
          <button className="hov" style={item} onClick={copy}>{copied ? "✓ Copied!" : "Copy link"}</button>
          {links.map((l) => (
            <a key={l.label} className="hov" style={item} href={l.href} target="_blank" rel="noreferrer noopener" onClick={() => setOpen(false)}>{l.label}</a>
          ))}
        </div>
      )}
    </div>
  );
}

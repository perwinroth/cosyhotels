"use client";
// Share control. Two shapes via `variant`:
//   "pill" (default) — a warm ember "Share stay" pill for hotel/detail headers.
//   "icon"           — a compact 34px round icon for list rows (guides, facets, homepage cards).
// Mobile → native share sheet (Web Share API) ONLY. Desktop → a popover: Copy link, Email, Pin it,
// WhatsApp, Facebook, Messenger, Instagram. `url` lets a list row share a specific HOTEL (absolute
// or "/"-relative); defaults to the current page.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Variant = "pill" | "icon";
export default function ShareButton({ title, text, url: urlProp, variant = "pill" }: { title?: string; text?: string; url?: string; variant?: Variant }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [igCopied, setIgCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Absolutize a "/"-relative url against the current origin; else use the given url or this page.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const here = typeof window !== "undefined" ? window.location.href : "";
    setUrl(urlProp ? (urlProp.startsWith("/") ? origin + urlProp : urlProp) : here);
  }, [urlProp]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const m = document.getElementById("share-menu-pop");
      if (ref.current && !ref.current.contains(e.target as Node) && !(m && m.contains(e.target as Node))) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onMove = () => setOpen(false); // menu is fixed-positioned; close on scroll/resize rather than drift
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); window.removeEventListener("scroll", onMove, true); window.removeEventListener("resize", onMove); };
  }, [open]);

  const t = title || (typeof document !== "undefined" ? document.title : "Got Cosy?");
  const toggleMenu = () => {
    if (open) { setOpen(false); return; }
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  };
  const onShare = async () => {
    const u = url || (typeof window !== "undefined" ? window.location.href : "");
    // Native share sheet only on touch devices (phones/tablets), where it's the better UX. On
    // desktop — where navigator.share now also exists — always show our own menu so Copy/Email/
    // Pinterest/WhatsApp/X are visible (that's the point of the control).
    const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
    if (coarse && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      // Mobile uses the native share sheet ONLY. Whether the user shares or cancels, we're done —
      // never fall through to the custom dropdown (that double-menu was the bug).
      try { await navigator.share({ title: t, text: text || t, url: u }); } catch { /* user cancelled — do nothing */ }
      return;
    }
    toggleMenu();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url || window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };

  const e = encodeURIComponent;
  const emailBody = `Thought you'd like this cosy hotel:\n\n${t}\n${url}\n\nShared from Got Cosy`;
  // Messenger: Facebook's send dialog needs an app id (set NEXT_PUBLIC_FB_APP_ID to enable desktop
  // prefill). Without one, fall back to the Messenger app deep link, which works on mobile.
  const fbAppId = process.env.NEXT_PUBLIC_FB_APP_ID;
  const messengerHref = fbAppId
    ? `https://www.facebook.com/dialog/send?app_id=${fbAppId}&link=${e(url)}&redirect_uri=${e(url)}`
    : `fb-messenger://share/?link=${e(url)}`;
  const links = [
    { label: "Email", href: `mailto:?subject=${e(t)}&body=${e(emailBody)}`, icon: ICON.mail },
    { label: "Pin it", href: `https://pinterest.com/pin/create/button/?url=${e(url)}&description=${e(t)}`, icon: ICON.pin },
    { label: "WhatsApp", href: `https://wa.me/?text=${e(`${t} ${url}`)}`, icon: ICON.whatsapp },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`, icon: ICON.facebook }, // appless — no FB app needed
    { label: "Messenger", href: messengerHref, icon: ICON.messenger },
  ];
  const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", fontSize: 13.5, color: "var(--foreground)", textDecoration: "none", whiteSpace: "nowrap", background: "transparent", border: "none", textAlign: "left", width: "100%", cursor: "pointer", borderRadius: 9 };
  const ico: React.CSSProperties = { width: 17, height: 17, flex: "none", color: "var(--muted)" };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {variant === "pill" ? (
        <button ref={btnRef} onClick={onShare} aria-label="Share this stay" aria-haspopup="menu" aria-expanded={open}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px 7px 12px", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--ember) 45%, var(--line))", background: "color-mix(in srgb, var(--ember) 7%, var(--card))", color: "var(--ember-ink)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          <span style={{ width: 15, height: 15 }} aria-hidden>{ICON.share}</span>
          Share stay
        </button>
      ) : (
        <button ref={btnRef} onClick={onShare} aria-label="Share" title="Share" aria-haspopup="menu" aria-expanded={open} className="hov"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 999, border: "1px solid var(--line)", background: "var(--card)", color: "var(--muted)", cursor: "pointer", flexShrink: 0 }}>
          <span style={{ width: 15, height: 15 }} aria-hidden>{ICON.share}</span>
        </button>
      )}
      {open && pos && typeof document !== "undefined" && createPortal(
        <div id="share-menu-pop" role="menu" style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 1000, minWidth: 192, background: "var(--card)", border: "1px solid var(--line)", borderRadius: 13, boxShadow: "var(--shadow-lg)", overflow: "hidden", padding: 5 }}>
          <button className="hov" style={{ ...row, fontWeight: 600 }} onClick={copy}>
            <span style={{ ...ico, color: "var(--ember)" }} aria-hidden>{ICON.copy}</span>
            <span style={{ flex: 1 }}>{copied ? "Copied!" : "Copy link"}</span>
            {copied && <span style={{ color: "var(--sage)", fontSize: 12 }}>✓</span>}
          </button>
          <div style={{ height: 1, background: "var(--line)", margin: "5px 6px" }} />
          {links.map((l) => (
            <a key={l.label} className="hov" style={row} href={l.href} target={l.label === "Email" || l.label === "Messenger" ? undefined : "_blank"} rel="noreferrer noopener" onClick={() => setOpen(false)}>
              <span style={ico} aria-hidden>{l.icon}</span>{l.label}
            </a>
          ))}
          {/* Instagram has no web share — copy the link so it can be pasted into a story/DM. */}
          <button className="hov" style={row} onClick={() => { try { navigator.clipboard.writeText(url); } catch { /* ignore */ } setIgCopied(true); setTimeout(() => setIgCopied(false), 2000); }}>
            <span style={ico} aria-hidden>{ICON.instagram}</span>
            <span style={{ flex: 1 }}>{igCopied ? "Copied. Paste in Instagram" : "Instagram"}</span>
            {igCopied && <span style={{ color: "var(--sage)", fontSize: 12 }}>✓</span>}
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

const ICON = {
  share: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 16V4" /><path d="m8 8 4-4 4 4" /></svg>),
  copy: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>),
  mail: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>),
  pin: (<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-2.6 13.5L8 22l4-3 4 3-1.4-6.5A7 7 0 0 0 12 2Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" /></svg>),
  whatsapp: (<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.4A10 10 0 1 0 12 2Zm0 2a8 8 0 0 1 6.8 12.3l-.3.5.8 2.9-3-.8-.4.2A8 8 0 1 1 12 4Zm4.3 9.9c-.2.6-1.2 1.2-1.7 1.2-.4 0-1 .1-3.2-.9-2.7-1.2-4.4-4-4.5-4.2-.1-.2-1-1.4-1-2.6s.6-1.8.9-2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2 1.2.9 1.6.9 1.9 1 .2 0 .4 0 .5-.2l.6-.8c.2-.3.4-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.3.1.7-.1 1.2Z" /></svg>),
  facebook: (<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12Z" /></svg>),
  messenger: (<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.3 2 2 6.2 2 11.3c0 2.9 1.4 5.5 3.6 7.2V22l3.3-1.8c.9.25 1.9.4 3.1.4 5.7 0 10-4.2 10-9.3S17.7 2 12 2Zm1 12.5-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8Z" /></svg>),
  instagram: (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>),
};

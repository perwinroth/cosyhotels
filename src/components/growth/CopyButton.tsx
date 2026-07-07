"use client";
import { useState } from "react";

// Small copy-to-clipboard button (used for the Instagram pitch on the Today plan — IG DMs can't be
// URL-prefilled, so Per copies the pitch then pastes it into the DM the "Open Instagram" link opens).
export default function CopyButton({ text, label = "Copy pitch" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
      }}
      style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)", borderRadius: 7, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

"use client";
// "Add your cosy badge" embed block on a hotel page — the copy-paste backlink snippet. When a hotel
// pastes it on their site it links back to their Got Cosy ranking (utm=badge). Always shown (it sits
// at the very bottom of the page, below the FAQ), so any hotel can find + grab its badge unprompted.
import { useState } from "react";

export default function BadgeEmbed({
  slug, score, name,
  // Reader-facing labels are translated by the server parent (hotel page) and passed in, since this
  // is a client component. English defaults keep every other caller unchanged.
  title = "Own this hotel? Add your cosy badge",
  blurb = "Show off your AI cosy score: paste this on your site and it links back to your ranking.",
  copyLabel = "Copy embed code",
  copiedLabel = "Copied",
}: { slug: string; score: number; name: string; title?: string; blurb?: string; copyLabel?: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const base = "https://gotcosy.com";
  const badgeSrc = `${base}/api/badge?score=${score.toFixed(1)}&name=${encodeURIComponent(name)}`;
  const link = `${base}/en/hotels/${slug}?utm_source=badge&utm_medium=referral`;
  const snippet = `<a href="${link}" target="_blank" rel="noopener"><img src="${badgeSrc}" alt="Rated ${score.toFixed(1)}/10 for cosiness by Got Cosy" width="240" height="92" loading="lazy"></a>`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };
  return (
    <section style={{ marginTop: 28, padding: 18, border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}>
      <div style={{ fontFamily: "var(--font-serif, Georgia), serif", fontSize: 17, fontWeight: 600 }}>{title}</div>
      <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "6px 0 14px" }}>{blurb}</p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgeSrc} alt={`Rated ${score.toFixed(1)} out of 10 for cosiness by Got Cosy`} width={240} height={92} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <textarea readOnly value={snippet} onFocus={(e) => e.currentTarget.select()} rows={3}
            style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, lineHeight: 1.5, color: "var(--foreground)", background: "var(--surface-2, #0B100E)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", resize: "vertical" }} />
          <button onClick={copy} className="hov" style={{ marginTop: 8, border: "1px solid var(--line)", background: "var(--ember)", color: "#14201A", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {copied ? `✓ ${copiedLabel}` : copyLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

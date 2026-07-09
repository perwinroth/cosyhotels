// Turn URL-ish tokens inside board card text into real links — the founder works these cards on a
// phone; "go to insights.ehotelier.com/submit-an-article" as dead prose means retyping by hand.
// Covers: full URLs, bare domains (with or without a path), emails (mailto:), and site-relative
// /en/... paths. Pure tokenizer exported for tests.
import React from "react";

export type LinkToken = { type: "text" | "link"; value: string; href?: string };

// Order matters: email before bare-domain (emails contain domains); full URL before bare domain.
const TOKEN_RE =
  /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|([A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})|((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*[^\s<>().,;:!?'"])?)|(\/en\/[a-z0-9\-/]+)/g;

export function splitLinkTokens(text: string): LinkToken[] {
  const out: LinkToken[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    // A bare domain immediately preceded by "@" is the tail of an email the email-branch already ate;
    // matchAll never overlaps, but guard against a domain match right after an "@" in plain text.
    if (m[3] && idx > 0 && text[idx - 1] === "@") continue;
    if (idx > last) out.push({ type: "text", value: text.slice(last, idx) });
    const raw = m[0];
    const href = m[1] ? raw : m[2] ? `mailto:${raw}` : m[3] ? `https://${raw}` : raw;
    out.push({ type: "link", value: raw, href });
    last = idx + raw.length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

export default function Linkify({ text }: { text: string }) {
  return (
    <>
      {splitLinkTokens(text).map((t, i) =>
        t.type === "link" ? (
          <a key={i} href={t.href} target={t.href?.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: "var(--ember)" }}>
            {t.value}
          </a>
        ) : (
          <React.Fragment key={i}>{t.value}</React.Fragment>
        )
      )}
    </>
  );
}

// Cookie-consent state (GDPR / ePrivacy). Client-safe: readable during SSR (always returns null
// there, since there is no document.cookie) and on the client.
//
// Gate: only "accepted" turns on non-essential cookies/scripts (Stay22 affiliate script,
// first-party analytics, Vercel Speed Insights). Strictly-necessary storage (theme, saved
// collections, this consent cookie itself) is never gated.

export type ConsentValue = "accepted" | "rejected";

const COOKIE_NAME = "gc_consent";
const CHANGE_EVENT = "gc-consent-change";
const MAX_AGE_SECONDS = 31536000; // 1 year

export function getConsent(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "accepted" || value === "rejected" ? value : null;
}

export function setConsent(v: ConsentValue): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_NAME}=${v}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* never break the page */
  }
}

export function hasAnalyticsConsent(): boolean {
  return getConsent() === "accepted";
}

export function onConsentChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

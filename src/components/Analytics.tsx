"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type GtagFn = (command: string, target: string, params?: Record<string, unknown>) => void;
declare global {
  interface Window {
    gtag?: GtagFn;
    GA_MEASUREMENT_ID?: string;
  }
}

// Stable anonymous first-party id for unique-visitor counts (no PII).
function visitorId(): string {
  try {
    let v = localStorage.getItem("gc_vid");
    if (!v) { v = crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2); localStorage.setItem("gc_vid", v); }
    return v;
  } catch { return ""; }
}

// Capture the ENTRY source once per session (utm_source, else referrer) and reuse it for every
// event — so a Pinterest visitor who clicks through 3 pages still attributes to pinterest.
function sessionSource(): { source: string | null; medium: string | null; campaign: string | null } {
  try {
    const saved = sessionStorage.getItem("gc_src");
    if (saved) return JSON.parse(saved);
    const sp = new URLSearchParams(window.location.search);
    const source = sp.get("utm_source") || null;
    const v = { source, medium: sp.get("utm_medium"), campaign: sp.get("utm_campaign") };
    if (source) sessionStorage.setItem("gc_src", JSON.stringify(v));
    return v;
  } catch { return { source: null, medium: null, campaign: null }; }
}

function track(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) { navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" })); return; }
    fetch("/api/track", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch { /* analytics must never break the page */ }
}

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Pageview → GA (existing) + first-party log.
  useEffect(() => {
    const gaId = (typeof window !== "undefined" && window.GA_MEASUREMENT_ID) || process.env.NEXT_PUBLIC_GA_ID;
    if (gaId && typeof window !== "undefined" && window.gtag) {
      window.gtag("config", gaId, { page_path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "") });
    }
    track({ type: "pageview", path: pathname, ...sessionSource(), visitor: visitorId(), referrer: typeof document !== "undefined" ? document.referrer : null });
  }, [pathname, searchParams]);

  // CTA click → GA + Vercel Analytics (existing) + first-party log.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as HTMLElement)?.closest?.("[data-cta]") as HTMLElement | null;
      if (!el) return;
      const cta = el.getAttribute("data-cta") || "cta";
      const hotel = el.getAttribute("data-hotel") || undefined;
      const city = el.getAttribute("data-city") || undefined;
      const props = { cta, hotel, city, path: pathname };
      try { window.gtag?.("event", cta, props); } catch {}
      try { (window as unknown as { va?: (e: string, n: string, p?: Record<string, unknown>) => void }).va?.("event", cta, props); } catch {}
      track({ type: "cta_click", cta, hotel, city, path: pathname, ...sessionSource(), visitor: visitorId() });
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}

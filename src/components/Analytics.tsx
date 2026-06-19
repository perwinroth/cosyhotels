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

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const gaId = (typeof window !== "undefined" && window.GA_MEASUREMENT_ID) || process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId || typeof window === "undefined" || !window.gtag) return;
    window.gtag("config", gaId, {
      page_path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ""),
    });
  }, [pathname, searchParams]);

  // Conversion tracking: any element tagged data-cta fires an event (GA + Vercel Analytics).
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
    }
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}

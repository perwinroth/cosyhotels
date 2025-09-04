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
  return null;
}

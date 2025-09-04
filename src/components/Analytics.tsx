"use client";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    const gaId = (window as any).GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID;
    if (!gaId || typeof window === "undefined" || !(window as any).gtag) return;
    (window as any).gtag("config", gaId, {
      page_path: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ""),
    });
  }, [pathname, searchParams]);
  return null;
}


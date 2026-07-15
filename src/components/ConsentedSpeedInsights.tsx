"use client";
import { useEffect, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { hasAnalyticsConsent, onConsentChange } from "@/lib/consent";

// Vercel Speed Insights is non-essential (performance telemetry): gate it behind consent, same as
// Stay22 and first-party analytics.
export default function ConsentedSpeedInsights() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasAnalyticsConsent());
    return onConsentChange(() => setAllowed(hasAnalyticsConsent()));
  }, []);

  if (!allowed) return null;

  return <SpeedInsights />;
}

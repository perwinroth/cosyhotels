"use client";
import { useEffect } from "react";

// Sets <html lang> to the actual page locale on mount.
//
// Why a client component: the ONLY <html> in the app is rendered by the ROOT layout
// (src/app/layout.tsx), which sits outside src/app/[locale] and has no params.locale of its own:
// there is exactly one <html> for the whole site, so it can't just read params in each locale
// route. A middleware-header + headers()-in-root-layout approach was tried and rejected: calling a
// dynamic API (headers()) in the root layout flips every route under it from static/ISR to
// server-rendered-on-demand (verified with a build A/B: /en went from "○ Static" to "ƒ Dynamic"),
// which would turn every cached page (hotel pages, city/country hubs, ...) into a live DB + Claude
// translate() call per request. This component keeps every page's static/ISR rendering unchanged
// and just corrects the lang attribute client-side after hydration. Google executes JS before
// indexing (documented two-wave rendering), so the corrected lang is what gets indexed.
export default function HtmlLang({ locale }: { locale: string }) {
  useEffect(() => {
    if (document.documentElement.lang !== locale) document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

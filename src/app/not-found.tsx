import type { Metadata } from "next";
import NotFoundView from "@/components/NotFoundView";

// Global 404 — the ultimate fallback (top-level unmatched routes + invalid-locale URLs, where the
// [locale] layout's notFound() bubbles past its own not-found up to here). Renders under the ROOT
// layout, so it has the Footer + theme toggle but not the site header; links point at canonical /en.
export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return <NotFoundView locale="en" />;
}

import type { Metadata } from "next";
import Home from "./[locale]/page";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  title: "Got Cosy? — AI-rated cosy hotels",
  description: "Hotels ranked by cosiness — scored 0–10 by AI for warmth, character and intimacy, not just stars.",
  openGraph: {
    title: "Got Cosy? — AI-rated cosy hotels",
    description: "Hotels ranked by cosiness — not just stars.",
    type: "website",
    url: "/",
  },
};

export default function RootHome() {
  // The "/" (and "/en") homepage is served by THIS root page, which does NOT get the [locale]
  // layout — so render the shared header here and wrap content in <main> for full semantic HTML
  // (header + main + footer landmarks), matching every other page.
  return (
    <>
      <SiteHeader locale="en" />
      <main><Home params={{ locale: 'en' }} /></main>
    </>
  );
}

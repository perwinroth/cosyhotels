import type { Metadata } from "next";
import Home from "./[locale]/page";
import SiteHeader from "@/components/SiteHeader";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  title: "Got Cosy? AI-rated cosy hotels",
  description: "Hotels ranked by cosiness, scored from 0 to 10 by AI for warmth, character and intimacy, not just stars.",
  openGraph: {
    title: "Got Cosy? AI-rated cosy hotels",
    description: "Hotels ranked by cosiness, not just stars.",
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
      {/* English source copy, no translate() needed on the root (English) homepage. The
          [locale] layout renders the same banner (translated) for every /[locale]/* page; the
          gc_consent cookie makes it show at most once regardless of which one rendered it. */}
      <CookieConsent
        labels={{
          message: "We use cookies for analytics and affiliate links. You choose.",
          accept: "Accept",
          reject: "Reject",
          privacy: "Privacy policy",
        }}
      />
    </>
  );
}

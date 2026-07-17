import type { Metadata } from "next";
import Home from "./[locale]/page";
import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
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
      {/* English source copy, no translate() needed here: this root "/" and "/en" homepage bypasses
          the [locale] layout, which renders its own (locale-aware) Footer for every /[locale]/*
          page instead. */}
      <Footer locale="en" />
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

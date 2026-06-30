import type { Metadata } from "next";
import Home from "./[locale]/page";

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
  // Render the localized homepage (hero, how-it-works, top hotels, browse-by-city, stats) for en.
  // Wrap in <main> for semantic HTML — the root "/" route doesn't get the [locale] layout's <main>.
  return <main><Home params={{ locale: 'en' }} /></main>;
}

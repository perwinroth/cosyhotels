import type { Metadata } from "next";
import Home from "./[locale]/page";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  title: "Cosy Hotel Rooms & Boutique Hotels | Get Cosy",
  description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide. Curated picks with helpful filters.",
  openGraph: {
    title: "Cosy Hotel Rooms & Boutique Hotels",
    description: "Discover cosy hotel rooms, boutique hotels, and romantic getaways worldwide.",
    type: "website",
    url: "/",
    images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }],
  },
};

export default function RootHome() {
  // Render the localized homepage (hero, how-it-works, top hotels, browse-by-city, stats) for en.
  return <Home params={{ locale: 'en' }} />;
}

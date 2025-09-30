import type { Metadata } from "next";
import HotelsPage from "./[locale]/hotels/page";

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

export default function RootHome({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  // Reuse the English hotels page as the root home
  // Cast props shape to satisfy TS for cross-render
  const Comp = HotelsPage as unknown as (p: { searchParams?: any; params: { locale: string } }) => any;
  return Comp({ searchParams: searchParams || {}, params: { locale: 'en' } });
}

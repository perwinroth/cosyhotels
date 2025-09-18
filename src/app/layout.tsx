import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-black">
        {children}
        <Toaster />
        <Footer locale="en" />
        <SpeedInsights />
      </body>
    </html>
  );
}

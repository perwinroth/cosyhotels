import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Travelpayouts site verification */}
        <Script id="travelpayouts" strategy="afterInteractive">
          {`(function () {
              var script = document.createElement("script");
              script.async = 1;
              script.src = 'https://emrldtp.com/NTQwNTM4.js?t=540538';
              document.head.appendChild(script);
          })();`}
        </Script>
      </head>
      <body className="antialiased">
        {children}
        <Toaster />
        <Footer locale="en" />
        <SpeedInsights />
      </body>
    </html>
  );
}

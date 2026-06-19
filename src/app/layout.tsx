import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import Toaster from "@/components/Toaster";

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
  other: { "verify-admitad": "fcd0c8cf9848b219283de8fda4c1ee95" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Stay22 LetMeAllez (LMA) — rewrites on-page OTA links into Stay22
            affiliate links client-side. lmaID is public (visible in page source);
            override via NEXT_PUBLIC_STAY22_LMAID. */}
        <Script id="stay22-lma" strategy="afterInteractive">
          {`(function (s, t, a, y, twenty, two) {
              s.Stay22 = s.Stay22 || {};
              s.Stay22.params = { lmaID: '${process.env.NEXT_PUBLIC_STAY22_LMAID || "6a346ecbb0b5e9d8d1e48a12"}' };
              twenty = t.createElement(a);
              two = t.getElementsByTagName(a)[0];
              twenty.async = 1;
              twenty.src = y;
              two.parentNode.insertBefore(twenty, two);
          })(window, document, 'script', 'https://scripts.stay22.com/letmeallez.js');`}
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

import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";
import Toaster from "@/components/Toaster";
import { organizationSchema, websiteSchema, jsonLd } from "@/lib/schema";
import { site } from "@/config/site";

export const metadata: Metadata = {
  // The "/" and "/en" homepages render under THIS root layout (not the [locale] layout), so their
  // relative canonicals need a metadataBase here to resolve to absolute gotcosy.com URLs.
  metadataBase: new URL(site.url),
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
  other: {
    "verify-admitad": "fcd0c8cf9848b219283de8fda4c1ee95",
    "p:domain_verify": "a104999227037e2d1f710928c1a6d755", // Pinterest domain claim (gotcosy.com)
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Fonts (Fraunces + Inter): loaded here via <link> instead of a CSS @import so the font
            stylesheet is fetched in parallel (not serialized behind globals.css) and the origins are
            preconnected. Identical families/weights/optical-size axis/display=swap as before. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Inter:wght@400;500;600;700&display=swap"
        />
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
        {/* Default = light (set on <html> for no flash). Honor a saved 'dark' choice before paint. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.removeAttribute('data-theme')}catch(e){}` }} />
      </head>
      <body className="antialiased">
        {/* Sitewide entity graph — one Organization + WebSite so SEO/AEO/GEO resolve "Got Cosy" to one entity. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationSchema())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(websiteSchema())} />
        {/* Theme toggle now lives IN the site header (SiteHeader), in-flow next to search, so it can
            never overlap the Search button again. It was a position:fixed overlay here before. */}
        {children}
        <Toaster />
        <Footer locale="en" />
        <SpeedInsights />
      </body>
    </html>
  );
}

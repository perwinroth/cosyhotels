import type { Metadata } from "next";
import "./globals.css";
import Toaster from "@/components/Toaster";
import ConsentedScripts from "@/components/ConsentedScripts";
import ConsentedSpeedInsights from "@/components/ConsentedSpeedInsights";
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
        {/* Stay22 LetMeAllez (LMA) — rewrites on-page OTA links into Stay22 affiliate links
            client-side. Non-essential (affiliate tracking): gated behind cookie consent, so the
            actual <Script> now lives in <ConsentedScripts /> below and only mounts once the
            visitor accepts. */}
        {/* Default = light (set on <html> for no flash). Honor a saved 'dark' choice before paint. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.removeAttribute('data-theme')}catch(e){}` }} />
      </head>
      <body className="antialiased">
        {/* Sitewide entity graph — one Organization + WebSite so SEO/AEO/GEO resolve "Got Cosy" to one entity. */}
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(organizationSchema())} />
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(websiteSchema())} />
        {/* Theme toggle now lives IN the site header (SiteHeader), in-flow next to search, so it can
            never overlap the Search button again. It was a position:fixed overlay here before. */}
        {/* Footer is NOT rendered here: this root layout wraps both the bare "/en" homepage
            (src/app/page.tsx, which renders its own English Footer) and every /[locale]/* route
            (src/app/[locale]/layout.tsx, which renders Footer with the real locale so it goes
            through translate() like the rest of that layout's chrome). A single hardcoded
            `<Footer locale="en" />` here meant EVERY locale's footer silently rendered in English
            forever, since this root layout sits above the [locale] segment and can't read its
            params (the same constraint documented in HtmlLang.tsx), found 2026-07-17 while
            auditing /sv for leftover English strings. */}
        {children}
        <Toaster />
        <ConsentedScripts />
        <ConsentedSpeedInsights />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import "../globals.css";
import Analytics from "@/components/Analytics";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} – ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  verification: {
    google: "vLnmpBYFWSQt5fNGXPQ5uYkLRQM_9GA7GcBQjR9jReo",
    other: {
      'impact-site-verification': '62d9ebe5-297e-48ad-8542-54ddc8680420',
    },
  },
  alternates: {
    canonical: "/",
    languages: Object.fromEntries([
      ...locales.map((l) => [l, `/${l}`]),
      ["x-default", "/"],
    ]),
  },
  openGraph: {
    type: "website",
    url: "/",
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  // NB: do NOT render <html>/<body> here — the ROOT layout (src/app/layout.tsx) owns them, along
  // with data-theme="light" and the no-flash script. A second <html> in this nested layout dropped
  // the theme attribute on client navigation (logo click flipped the site to dark). This is a
  // normal nested layout: just the header + page content.
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="min-h-[75vh]">{children}</main>
      {/* Footer + ThemeToggle are rendered globally in the root layout to avoid duplicates */}
      <Analytics />
    </>
  );
}

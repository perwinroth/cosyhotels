import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import "../globals.css";
import Analytics from "@/components/Analytics";
import SiteHeader from "@/components/SiteHeader";
import CookieConsent from "@/components/CookieConsent";
import { translate } from "@/lib/i18n/translate";

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
  // NB: no layout-level `alternates` — a shared canonical here is inherited by every page that
  // doesn't set its own, so canonical-less pages (cosy-score, privacy, …) were all claiming the
  // homepage ("/") as their canonical. Each page now sets its own self-referencing canonical.
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
  // Reject unknown locales. Without this, ANY path segment (/randomjunk123, /sitemap-foo.xml,
  // /xx/hotels/…) rendered a real 200 page, self-canonical to the junk URL — a canonical-confusion
  // factory in Google Search Console. Only the 6 known locales render; everything else 404s.
  if (!(locales as readonly string[]).includes(locale)) notFound();
  // Cookie-consent banner copy, translated per the site's standard pattern. Rendered once here so
  // every /[locale]/* page gets it; the root "/" homepage (which bypasses this layout) renders its
  // own English-only copy of the same banner in src/app/page.tsx instead.
  const t = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const [consentMessage, consentAccept, consentReject, consentPrivacy] = await Promise.all([
    t("We use cookies for analytics and affiliate links. You choose."),
    t("Accept"),
    t("Reject"),
    t("Privacy policy"),
  ]);
  // NB: do NOT render <html>/<body> here — the ROOT layout (src/app/layout.tsx) owns them, along
  // with data-theme="light" and the no-flash script. A second <html> in this nested layout dropped
  // the theme attribute on client navigation (logo click flipped the site to dark). This is a
  // normal nested layout: just the header + page content.
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="min-h-[75vh]">{children}</main>
      {/* Footer + ThemeToggle are rendered globally in the root layout to avoid duplicates */}
      {/* Suspense is REQUIRED: Analytics calls useSearchParams(), and on static/ISR pages
          (hotels/[slug]) an unsuspended CSR bailout is a hard 500 at on-demand render time.
          Local builds don't catch it — no hotel page prerenders at build. */}
      <Suspense fallback={null}>
        <Analytics />
      </Suspense>
      <CookieConsent
        labels={{ message: consentMessage, accept: consentAccept, reject: consentReject, privacy: consentPrivacy }}
      />
    </>
  );
}

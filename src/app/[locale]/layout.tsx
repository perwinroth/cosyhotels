import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import "../globals.css";
import Analytics from "@/components/Analytics";
import HeaderSearch from "@/components/HeaderSearch";

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
  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`antialiased`} style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <header className="sticky top-0 z-30 border-b" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)' }}>
          {/* Clean header: logo + search only. The three content links (City guides, Cosy
              score, For-hotels) live site-wide in the footer, so removing them here keeps the
              internal-link/SEO value while decluttering the top. Same on desktop and mobile. */}
          <div className="mx-auto max-w-6xl px-4 h-[68px] flex items-center justify-between gap-3">
            <Link href={`/`} className="flex items-center gap-2.5 no-underline shrink-0">
              <span aria-hidden className="flex items-center justify-center rounded-[11px]" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--ember), var(--gold))' }}>
                {/* Brand mark: the inverted flame that reads as a 'c' — same as the favicon. */}
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path transform="scale(-1,1) translate(-24,0)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#16201C" />
                </svg>
              </span>
              <span className="font-display text-xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Got Cosy?</span>
            </Link>
            <HeaderSearch locale={locale} />
          </div>
        </header>
        <main className="min-h-[75vh]">{children}</main>
        {/* Footer is rendered globally in root layout to avoid duplicates */}
        <Analytics />
      </body>
    </html>
  );
}

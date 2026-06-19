import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { locales } from "@/i18n/locales";
import "../globals.css";
import Analytics from "@/components/Analytics";
import LanguageSwitcher from "@/components/LanguageSwitcher";
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
    <html lang={locale}>
      <body className={`antialiased`} style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
        <header className="sticky top-0 z-30 border-b" style={{ borderColor: 'var(--line)', background: 'rgba(15,21,18,0.82)', backdropFilter: 'blur(12px)' }}>
          <div className="mx-auto max-w-6xl px-4 h-[68px] flex items-center justify-between">
            <Link href={`/`} className="flex items-center gap-2.5 no-underline">
              <span aria-hidden className="flex items-center justify-center rounded-[11px] font-display font-bold" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--ember), var(--gold))', color: '#16201C', fontSize: 17 }}>c</span>
              <span className="font-display text-xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Got Cosy?</span>
            </Link>
            <nav className="flex gap-7 text-sm items-center" style={{ color: 'var(--muted)' }}>
              <Link href={`/${locale}/guides`} prefetch={false} className="no-underline hover:text-[#F3EEE6]">City guides</Link>
              <Link href={`/${locale}/cosy-score`} prefetch={false} className="no-underline hover:text-[#F3EEE6]">Cosy score</Link>
              <Link href={`/${locale}/for-hotels`} prefetch={false} className="no-underline hover:text-[#F3EEE6]">Get your cosy score</Link>
              <HeaderSearch locale={locale} />
              <LanguageSwitcher current={locale} />
            </nav>
          </div>
        </header>
        <main className="min-h-[75vh]">{children}</main>
        {/* Footer is rendered globally in root layout to avoid duplicates */}
        <Analytics />
      </body>
    </html>
  );
}

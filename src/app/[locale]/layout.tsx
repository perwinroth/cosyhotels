import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { site } from "@/config/site";
import "../globals.css";
import { messages } from "@/i18n/messages";
import Analytics from "@/components/Analytics";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} – ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
    images: [{ url: "/logo-seal.svg", width: 1200, height: 800 }],
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
  const m = messages[locale as keyof typeof messages] ?? messages.en;
  return (
    <html lang={locale}>
      <body className={`antialiased bg-white text-zinc-900`}>
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
            <Link href={`/${locale}`} className="flex items-center gap-2 font-semibold tracking-tight">
              <Image src="/seal.svg" alt={site.name} width={40} height={40} priority />
              <span className="sr-only">{site.name}</span>
              <span aria-hidden className="text-lg font-semibold uppercase tracking-wide text-[#0EA5A4]">Get cosy</span>
            </Link>
            <nav className="flex gap-4 text-sm items-center">
              <Link href={`/${locale}/collections`} prefetch={false} className="hover:underline">{m.nav.collections}</Link>
              <Link href={`/${locale}/guides`} prefetch={false} className="hover:underline">{m.nav.guides}</Link>
              <Link href={`/${locale}/cosy-score`} prefetch={false} className="hover:underline">How we calculate</Link>
              <Link href={`/${locale}/cosy-score#seal`} prefetch={false} className="hover:underline">
                seal of approval
              </Link>
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

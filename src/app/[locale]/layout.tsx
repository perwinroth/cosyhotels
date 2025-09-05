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
    images: [{ url: "/hotel-placeholder.svg", width: 1200, height: 800 }],
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
              <Image src="/logo-seal.svg" alt={site.name} width={140} height={36} priority />
            </Link>
            <nav className="flex gap-4 text-sm items-center">
              <Link href={`/${locale}/hotels`} className="hover:underline">{m.nav.explore}</Link>
              <Link href={`/${locale}/collections`} className="hover:underline">{m.nav.collections}</Link>
              <Link href={`/${locale}/guides`} className="hover:underline">{m.nav.guides}</Link>
              <LanguageSwitcher current={locale} />
            </nav>
          </div>
        </header>
        <main className="min-h-[75vh]">{children}</main>
        <footer className="border-t brand-border">
          <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-black">
            <div>
              <strong className="text-black">{site.name}</strong> · {site.description}
            </div>
            <nav className="flex gap-4">
              <Link href={`/${locale}/cosy-score`} className="hover:underline">Cosy score</Link>
              <Link href={`/${locale}/disclosure`} className="hover:underline">Affiliate disclosure</Link>
              <Link href={`/${locale}/privacy`} className="hover:underline">Privacy</Link>
              <Link href={`/${locale}/about`} className="hover:underline">About</Link>
              <Link href={`/${locale}/contact`} className="hover:underline">Contact</Link>
            </nav>
            <div>© {new Date().getFullYear()} {site.name}</div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}

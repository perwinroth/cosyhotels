import Link from "next/link";
import { Suspense } from "react";
import { FeaturedHotels, PopularDestinations, SearchBar } from "@/components/HomeSections";
import Filters from "@/components/Filters";
import HomeGrid from "@/components/HomeGrid";
import { site } from "@/config/site";
import { messages } from "@/i18n/messages";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const { locale } = params;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}`]));
  return {
    alternates: {
      canonical: `/${locale}`,
      languages,
    },
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
  };
}

export default function Home({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const m = messages[locale as keyof typeof messages] ?? messages.en;
  return (
    <div>
      <section className="bg-zinc-50 border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">{m.brand.tagline}</h1>
          <p className="mt-3 text-zinc-600 max-w-2xl">{m.brand.description}</p>
          <div className="mt-6">
            <SearchBar locale={locale} />
          </div>
          <div className="mt-4 text-sm text-zinc-600">
            <Link href={`/${locale}/hotels`} className="underline">{m.home.browseAll}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <HomeGrid locale={locale} />
      </section>
    </div>
  );
}

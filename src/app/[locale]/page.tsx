import { site } from "@/config/site";
import type { Metadata } from "next";
import { locales } from "@/i18n/locales";
import { redirect } from "next/navigation";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const { locale } = params;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}`]));
  return {
    alternates: { canonical: `/${locale}`, languages },
    title: `${site.name} – ${site.tagline}`,
    description: site.description,
  };
}

export default function Home({ params }: { params: { locale: string } }) {
  const { locale } = params;
  redirect(`/${locale}/hotels`);
}


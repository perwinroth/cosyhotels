import Link from "next/link";
import type { Metadata } from "next";
import { collections } from "@/data/collections";
import { locales } from "@/i18n/locales";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/collections`]));
  return {
    alternates: { canonical: `/${params.locale}/collections`, languages },
    title: "Collections",
    description: "Curated themes to explore cosy boutique stays.",
  };
}


export default function CollectionsIndex({ params }: { params: { locale: string } }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Collections</h1>
      <p className="mt-2 text-zinc-600">Curated hotel themes for inspiration and planning.</p>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {collections.map((c) => (
          <Link key={c.slug} href={`/${params.locale}/collections/${c.slug}`} className="block rounded-xl border border-zinc-200 p-4 hover:shadow-sm">
            <h2 className="font-medium">{c.title}</h2>
            <p className="text-sm text-zinc-600 mt-1">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

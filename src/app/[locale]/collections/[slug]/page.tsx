import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCollection } from "@/data/collections";
import { hotels } from "@/data/hotels";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const c = getCollection(params.slug);
  if (!c) return {};
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/collections/${c.slug}`]));
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: `/${params.locale}/collections/${c.slug}`, languages },
    openGraph: {
      title: c.title,
      description: c.description,
      type: "website",
      images: [{ url: "/hotel-placeholder.svg", width: 1200, height: 800 }],
    },
  };
}

export default function CollectionPage({ params }: Props) {
  const c = getCollection(params.slug);
  if (!c) return <div className="mx-auto max-w-6xl px-4 py-8">Collection not found.</div>;
  const results = hotels.filter(c.filter);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{c.title}</h1>
      <p className="mt-2 text-zinc-600 max-w-2xl">{c.description}</p>
      <div className="mt-6 grid md:grid-cols-3 gap-4">
        {results.map((h) => (
          <Link key={h.slug} href={`/${params.locale}/hotels/${h.slug}`} className="block rounded-xl border border-zinc-200 overflow-hidden hover:shadow-sm">
            <div className="relative aspect-[4/3] bg-zinc-100">
              <Image src="/hotel-placeholder.svg" alt={`${h.name} – ${h.city}`} fill className="object-cover" />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{h.name}</h3>
                <span className="text-xs rounded bg-emerald-100 text-emerald-700 px-2 py-0.5">{h.rating.toFixed(1)}</span>
              </div>
              <div className="text-sm text-zinc-600">{h.city}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

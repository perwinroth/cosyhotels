import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getCollection } from "@/data/collections";
import { hotels } from "@/data/hotels";
import { cosyScore, cosyBadgeClass, cosyRankLabel } from "@/lib/scoring/cosy";
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

type WithCosy<T> = T & { _cosy: number };

export default function CollectionPage({ params }: Props) {
  const c = getCollection(params.slug);
  if (!c) return <div className="mx-auto max-w-6xl px-4 py-8">Collection not found.</div>;
  const base = hotels.filter(c.filter);
  const results: WithCosy<typeof hotels[number]>[] = base.map((h) => ({
    ...h,
    _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }),
  }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">{c.title}</h1>
      <p className="mt-2 text-black max-w-2xl">{c.description}</p>
      {results.length === 0 ? (
        <div className="mt-6 rounded-xl border brand-border p-4 bg-white">
          <div className="font-medium">We’re curating this collection.</div>
          <p className="text-sm text-black mt-1">No hotels match yet. Explore all hotels or check back soon.</p>
          <div className="mt-3"><Link className="underline" href={`/${params.locale}/hotels`}>Browse all hotels</Link></div>
        </div>
      ) : (
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {results.map((h) => (
            <Link key={h.slug} href={`/${params.locale}/hotels/${h.slug}`} className="block rounded-2xl border brand-border overflow-hidden hover:shadow-md bg-white">
              <div className="relative aspect-[4/3] bg-zinc-100">
                <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" />
                {h._cosy >= 7 ? (
                  <div className="absolute -left-3 top-4 rotate-[-15deg]">
                    <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
                      <span>Seal of approval</span>
                    </div>
                  </div>
                ) : null}
                <div className="absolute left-2 top-2"><span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>Cosy {h._cosy.toFixed(1)} · {cosyRankLabel(h._cosy)}</span></div>
              </div>
              <div className="p-3">
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <div className="text-sm text-zinc-600">{h.city}</div>
                <div className="mt-4" />
                <div className="mt-2 flex justify-end">
                  <button type="button" className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50">Save to shortlist</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

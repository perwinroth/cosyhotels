import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels as baseHotels } from "@/data/hotels";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import { cosyBadgeClass, cosyRankLabel, cosyScore } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";
import EditShortlistMeta from "@/components/EditShortlistMeta";

async function getShortlist(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/shortlists/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function ShortlistPage({ params }: { params: { slug: string } }) {
  const sl = await getShortlist(params.slug);
  const overrides = await fetchOverrides();
  const hotels = applyOverrides(baseHotels, overrides);
  const map = new Map(hotels.map((h) => [h.slug, h]));
  const items: string[] = sl?.items || [];
  const picked = items.map((s) => map.get(s)).filter(Boolean) as typeof hotels;
  const withCosy = picked.map((h) => ({ ...h, _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }) }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Shortlist: {sl?.title || params.slug}</h1>
        <EditShortlistMeta slug={params.slug} title={sl?.title} />
      </div>
      {!sl && (
        <div className="mt-4 text-sm text-zinc-600">Shortlist not found on server. Checking your device…</div>
      )}
      {!sl && (
        // @ts-expect-error Client component
        <ShortlistLocalFallback slug={params.slug} hotels={hotels} />
      )}
      <div className="mt-6 grid md:grid-cols-3 gap-4 auto-rows-fr">
        {withCosy.map((h) => (
          <Link key={h.slug} href={`/en/hotels/${h.slug}`} className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full">
            <div className="relative aspect-[4/3] bg-zinc-100">
              <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
              {h._cosy >= 6.5 ? (
                <div className="absolute -left-3 top-4 rotate-[-15deg]">
                  <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
                    <Image src="/seal.svg" alt="seal" width={14} height={14} />
                    <span>Seal of approval</span>
                  </div>
                </div>
              ) : null}
              <div className="absolute left-2 top-2 flex gap-2">
                <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>Cosy {h._cosy.toFixed(1)} · {cosyRankLabel(h._cosy)}</span>
              </div>
              <div className="absolute right-2 top-2 text-xs rounded bg-black/70 text-white px-2 py-0.5">★ {h.rating.toFixed(1)}</div>
            </div>
            <div className="p-3 flex flex-col h-[188px]">
              <div>
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <div className="text-sm text-black">{h.city}</div>
                <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>
              </div>
              <div className="mt-auto pt-4 flex justify-end">
                <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
function ShortlistLocalFallback({ slug, hotels }: { slug: string; hotels: typeof baseHotels }) {
  const [items, setItems] = useState<string[] | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`shortlistItems:${slug}`);
      if (!raw) setItems([]); else setItems(JSON.parse(raw));
    } catch {
      setItems([]);
    }
  }, [slug]);
  const map = useMemo(() => new Map(hotels.map(h => [h.slug, h])), [hotels]);
  const picked = (items || []).map(s => map.get(s)).filter(Boolean) as typeof hotels;
  if (items == null) return <div className="mt-4 text-sm text-zinc-600">Loading…</div>;
  if (picked.length === 0) return <div className="mt-4 text-sm text-zinc-600">No saved hotels on this device for this shortlist.</div>;
  return (
    <div className="mt-6 grid md:grid-cols-3 gap-4 auto-rows-fr">
      {picked.map((h) => (
        <a key={h.slug} href={`/en/hotels/${h.slug}`} className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full">
          <div className="relative aspect-[4/3] bg-zinc-100">
            <img src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} className="object-cover w-full h-full" />
          </div>
          <div className="p-3">
            <h3 className="font-medium line-clamp-1">{h.name}</h3>
            <div className="text-sm text-black">{h.city}</div>
          </div>
        </a>
      ))}
    </div>
  );
}

// Client-only edit controls moved to component

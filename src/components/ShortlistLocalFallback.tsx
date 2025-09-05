"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Hotel } from "@/data/hotels";

export default function ShortlistLocalFallback({ slug, hotels }: { slug: string; hotels: Hotel[] }) {
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
  const picked = (items || []).map(s => map.get(s)).filter(Boolean) as Hotel[];
  if (items == null) return <div className="mt-4 text-sm text-zinc-600">Loading…</div>;
  if (picked.length === 0) return <div className="mt-4 text-sm text-zinc-600">No saved hotels on this device for this shortlist.</div>;
  return (
    <div className="mt-6 grid md:grid-cols-3 gap-4 auto-rows-fr">
      {picked.map((h) => (
        <Link key={h.slug} href={`/en/hotels/${h.slug}`} className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full">
          <div className="relative aspect-[4/3] bg-zinc-100">
            <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" sizes="(max-width: 768px) 100vw, 400px" />
          </div>
          <div className="p-3">
            <h3 className="font-medium line-clamp-1">{h.name}</h3>
            <div className="text-sm text-black">{h.city}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

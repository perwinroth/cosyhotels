"use client";
import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels, destinations, Hotel } from "@/data/hotels";
import { cosyScore, cosyRankLabel, cosyBadgeClass } from "@/lib/scoring/cosy";
import { useState } from "react";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";
import { useRouter } from "next/navigation";

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [city, setCity] = useState("");
  const [rank, setRank] = useState(""); // high|mid|low
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (city) params.set("city", city);
        if (rank) params.set("rank", rank);
        setSubmitting(true);
        router.push(`/${locale}/hotels?${params.toString()}`);
      }}
      className="grid md:grid-cols-[1fr_200px_auto] gap-3"
    >
      <input
        className="border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        placeholder="Paris, Rome, Lisbon…"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <select
        className="border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        value={rank}
        onChange={(e) => setRank(e.target.value)}
        aria-label="Quality rank"
      >
        <option value="">Any rank</option>
        <option value="high">High</option>
        <option value="mid">Mid</option>
        <option value="low">Low</option>
      </select>
      <button
        className="rounded-lg bg-black text-white px-4 py-2 hover:bg-black/90 active:translate-y-[1px] active:bg-black/80 disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={submitting}
      >
        {submitting ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

export function PopularDestinations({ className = "", locale = "en" }: { className?: string; locale?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {destinations.map((d) => (
        <Link
          key={d.slug}
          href={`/${locale}/hotels?city=${encodeURIComponent(d.city)}`}
          className="group relative overflow-hidden rounded-xl border border-zinc-200"
        >
          <div className="aspect-[4/3] bg-zinc-100 flex items-end p-3">
            <div className="text-sm font-medium">{d.city}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function FeaturedHotels({ className = "", locale = "en" }: { className?: string; locale?: string }) {
  const featured = hotels.filter((h) => h.featured).slice(0, 6);
  return (
    <div className={`grid md:grid-cols-3 gap-4 ${className}`}>
      {featured.map((h) => (
        <HotelCard key={h.slug} hotel={h} locale={locale} />)
      )}
    </div>
  );
}

export function HotelCard({ hotel, locale = "en" }: { hotel: Hotel; locale?: string }) {
  const cosy = cosyScore({ rating: hotel.rating, amenities: hotel.amenities, description: hotel.description });
  return (
    <Link
      href={`/${locale}/hotels/${hotel.slug}`}
      className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md transition-shadow bg-white h-full"
    >
      <div className="relative aspect-[4/3] bg-zinc-100">
        <Image src={hotel.image || "/seal.svg"} alt={`${hotel.name} – ${hotel.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
        {cosy >= 6.5 ? (
          <div className="absolute -left-3 top-4 rotate-[-15deg]">
            <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
              <Image src="/seal.svg" alt="seal" width={14} height={14} />
              <span>Seal of approval</span>
            </div>
          </div>
        ) : null}
        <div className="absolute left-2 top-2 flex gap-2">
          <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(cosy)}`}>
            Cosy {cosy.toFixed(1)} · {cosyRankLabel(cosy)}
          </span>
        </div>
      </div>
      <div className="p-3 flex flex-col h-[188px]">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-medium line-clamp-1">{hotel.name}</h3>
            <span className="text-xs rounded bg-black/80 text-white px-2 py-0.5">★ {hotel.rating.toFixed(1)}</span>
          </div>
          <div className="text-sm text-black">{hotel.city}</div>
          <div className="mt-3 text-sm font-medium brand-price">From ${hotel.price}/night</div>
        </div>
        <div className="mt-auto pt-4 flex justify-end">
          <SaveToShortlistButton itemSlug={hotel.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
        </div>
      </div>
    </Link>
  );
}

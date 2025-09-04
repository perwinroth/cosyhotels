"use client";
import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels, destinations, Hotel } from "@/data/hotels";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (city) params.set("city", city);
        if (minRating) params.set("minRating", minRating);
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
        value={minRating}
        onChange={(e) => setMinRating(e.target.value)}
      >
        <option value="">Any rating</option>
        <option value="8.5">8.5+</option>
        <option value="9.0">9.0+</option>
        <option value="9.5">9.5+</option>
      </select>
      <button className="rounded-lg bg-zinc-900 text-white px-4 py-2 hover:bg-zinc-800">Search</button>
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
  return (
    <Link
      href={`/${locale}/hotels/${hotel.slug}`}
      className="block overflow-hidden rounded-xl border border-zinc-200 hover:shadow-sm transition-shadow"
    >
      <div className="relative aspect-[4/3] bg-zinc-100">
        <Image src="/hotel-placeholder.svg" alt={`${hotel.name} – ${hotel.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">{hotel.name}</h3>
          <span className="text-xs rounded bg-emerald-100 text-emerald-700 px-2 py-0.5">{hotel.rating.toFixed(1)}</span>
        </div>
        <div className="text-sm text-zinc-600">{hotel.city}</div>
        <div className="mt-2 text-sm text-zinc-700">From ${hotel.price}/night</div>
      </div>
    </Link>
  );
}

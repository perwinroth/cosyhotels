"use client";
import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels, destinations, Hotel } from "@/data/hotels";
import { cosyScore, cosyRankLabel, cosyBadgeClass } from "@/lib/scoring/cosy";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
/* removed duplicate useRouter import */

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const values = {
    rank: searchParams.get("rank") || "",
    sort: searchParams.get("sort") || "cosy-desc",
    amenities: searchParams.getAll("amenity"),
  };

  function update(next: Partial<typeof values>) {
    const sp = new URLSearchParams(searchParams.toString());
    if ("rank" in next) {
      if (!next.rank) sp.delete("rank"); else sp.set("rank", String(next.rank));
    }
    if ("sort" in next) {
      if (!next.sort) sp.delete("sort"); else sp.set("sort", String(next.sort));
    }
    if ("amenities" in next) {
      sp.delete("amenity");
      (next.amenities || []).forEach((a) => sp.append("amenity", a));
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const amenityOptions = [
    "Spa","Sauna","Rooftop","Garden","Bar","Restaurant","Pool","Pet-friendly","Gym",
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams(searchParams.toString());
        if (city) sp.set("city", city); else sp.delete("city");
        setSubmitting(true);
        router.push(`/${locale}/hotels?${sp.toString()}`);
      }}
      className="relative grid md:grid-cols-[1fr_auto_auto] gap-3"
    >
      <input
        className="border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        placeholder="Paris, Rome, Lisbon…"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg px-4 py-2 border border-zinc-300 hover:bg-zinc-50"
        >
          Filter
        </button>
        {open && (
          <div className="absolute right-0 mt-1 z-30 w-[300px] rounded-lg border border-zinc-200 bg-white shadow p-3">
            <div className="text-sm font-medium mb-2">Sort by</div>
            <div className="flex flex-col gap-1 text-sm mb-3">
              {[
                { label: "Cosy (high → low)", value: "cosy-desc" },
                { label: "Cosy (low → high)", value: "cosy-asc" },
              ].map((s) => (
                <label key={s.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sort"
                    checked={values.sort === s.value}
                    onChange={() => update({ sort: s.value })}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            <div className="text-sm font-medium mb-2">Amenities</div>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((a) => {
                const active = values.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = new Set(values.amenities);
                      if (active) next.delete(a); else next.add(a);
                      update({ amenities: Array.from(next) });
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-zinc-300 ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-zinc-300 text-black bg-white'}`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-right">
              <button type="button" className="text-sm px-3 py-1.5 rounded border brand-border hover:bg-zinc-50" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
      <button
        className="rounded-lg bg-[#0EA5A4] text-white px-4 py-2 hover:bg-[#0B807F] active:translate-y-[1px] active:bg-[#0B807F] disabled:opacity-60 disabled:cursor-not-allowed"
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
        <Image src={hotel.image || "/logo-seal.svg"} alt={`${hotel.name} – ${hotel.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px" />
        {cosy >= 6.5 ? (
          <div className="absolute -left-3 top-4 rotate-[-15deg]">
            <div className="flex items-center gap-1 bg-[#0EA5A4] text-white text-xs px-3 py-1 rounded-full shadow">
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
        <h3 className="font-medium line-clamp-1">{hotel.name}</h3>
          <div className="text-sm text-black">{hotel.city}, {hotel.country}</div>
          <div className="mt-3 text-sm font-medium brand-price">From ${hotel.price}/night</div>
        </div>
        <div className="mt-auto pt-4" />
      </div>
    </Link>
  );
}

"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cities } from "@/data/cities";
import { citiesLarge } from "@/data/cities_large";
import { cityToSlug } from "@/lib/citySlug";

// Combined, deduped city list for instant local autocomplete (replaces Amadeus).
const ALL_CITIES: string[] = Array.from(new Set([...cities, ...citiesLarge])).sort();

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  // Reset submitting state whenever URL changes (search completes)
  useEffect(() => {
    setSubmitting(false);
  }, [pathname, searchParams]);

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

  // Local city suggestions — free, instant, no external API (Amadeus removed).
  useEffect(() => {
    const q = city.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const starts = ALL_CITIES.filter((c) => c.toLowerCase().startsWith(q));
    const contains = ALL_CITIES.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
    setSuggestions([...starts, ...contains].slice(0, 8));
    setShowSuggest(true);
  }, [city]);

  const amenityOptions = [
    "Spa","Sauna","Rooftop","Garden","Bar","Restaurant","Pool","Pet-friendly","Gym",
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!city.trim()) return;
        // Route to the canonical city page (one consistent destination).
        const slug = cityToSlug(city);
        setSubmitting(true);
        router.push(`/${locale}/guides/${slug}`);
        setOpen(false);
      }}
      className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px_auto] gap-2 md:gap-2"
    >
      <div className="relative">
      <input
        className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2"
        style={{ border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--foreground)' }}
        placeholder="Paris, Rome, Lisbon…"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        onFocus={() => setShowSuggest(true)}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
      />
      {showSuggest && suggestions.length > 0 && (
        <div className="absolute mt-1 w-full z-20 rounded-md border border-line bg-card shadow">
          <ul className="max-h-64 overflow-auto">
            {suggestions.map((s, i) => (
              <li key={`${s}-${i}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hov"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setCity(s); setShowSuggest(false); }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg px-4 py-2 border border-line hov"
        >
          Filter
        </button>
        {open && (
          <div className="absolute right-0 mt-1 z-30 w-[300px] rounded-lg border border-line bg-card shadow p-3">
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
                    className={`px-3 py-1.5 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-zinc-300 ${active ? 'text-ember' : 'border-line text-foreground bg-card'}`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-right">
              <button type="button" className="text-sm px-3 py-1.5 rounded border brand-border hov" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
      <button
        className="rounded-lg text-white px-5 py-2.5 active:translate-y-[1px] disabled:opacity-60 disabled:cursor-not-allowed font-medium"
        style={{ background: 'var(--ember)' }}
        disabled={submitting}
      >
        {submitting ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

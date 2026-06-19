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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  // Reset submitting state whenever URL changes (search completes)
  useEffect(() => {
    setSubmitting(false);
  }, [pathname, searchParams]);

  // Local city suggestions — free, instant, no external API (Amadeus removed).
  useEffect(() => {
    const q = city.trim().toLowerCase();
    if (!q) { setSuggestions([]); return; }
    const starts = ALL_CITIES.filter((c) => c.toLowerCase().startsWith(q));
    const contains = ALL_CITIES.filter((c) => !c.toLowerCase().startsWith(q) && c.toLowerCase().includes(q));
    setSuggestions([...starts, ...contains].slice(0, 8));
    setShowSuggest(true);
  }, [city]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!city.trim()) return;
        // Route to the canonical city page (one consistent destination).
        const slug = cityToSlug(city);
        setSubmitting(true);
        router.push(`/${locale}/guides/${slug}`);
      }}
      className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 md:gap-2"
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
      {/* Filter hidden for now (sort/amenities not wired to the Supabase-served results yet). */}
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

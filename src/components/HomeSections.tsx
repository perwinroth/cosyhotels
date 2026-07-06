"use client";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Autocomplete data comes from /api/search (hotels by name + cities with a live guide). Every plain
// submit goes to /search (200 for any string) — never slugified into a /guides URL that can 404.
type HotelHit = { slug: string; name: string; city: string; country?: string };
type CityHit = { name: string; slug: string };
type CountryHit = { name: string; slug: string; count: number };

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [q, setQ] = useState("");
  const [hotels, setHotels] = useState<HotelHit[]>([]);
  const [cities, setCities] = useState<CityHit[]>([]);
  const [countries, setCountries] = useState<CountryHit[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const seq = useRef(0);

  // Reset submitting state whenever the URL changes (navigation completed).
  useEffect(() => { setSubmitting(false); }, [pathname, searchParams]);

  // Debounced hotel+city search. Out-of-order (stale) responses are ignored via a monotonic seq.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setHotels([]); setCities([]); setCountries([]); return; }
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok || mine !== seq.current) return;
        const data = await res.json();
        if (mine !== seq.current) return;
        setHotels(Array.isArray(data.hotels) ? data.hotels : []);
        setCities(Array.isArray(data.cities) ? data.cities : []);
        setCountries(Array.isArray(data.countries) ? data.countries : []);
        setShowSuggest(true);
      } catch { /* ignore transient fetch errors */ }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => { setSubmitting(true); setShowSuggest(false); router.push(href); };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        // Always land on /search — it renders 200 for any string (matches, or a friendly empty
        // state). Never build a /guides slug from free text (that was the hotel-name 404 bug).
        go(`/${locale}/search?q=${encodeURIComponent(q.trim())}`);
      }}
      className="relative grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-2 md:gap-2"
    >
      <div className="relative">
      <input
        className="w-full rounded-lg px-3.5 py-2.5 focus:outline-none focus:ring-2"
        style={{ border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--foreground)' }}
        placeholder="Search a hotel or city…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setShowSuggest(true)}
        onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
      />
      {showSuggest && (hotels.length > 0 || cities.length > 0 || countries.length > 0) && (
        <div className="absolute mt-1 w-full z-20 rounded-md border border-line bg-card shadow">
          <ul className="max-h-72 overflow-auto">
            {hotels.map((h) => (
              <li key={`h-${h.slug}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hov"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(`/${locale}/hotels/${h.slug}`)}
                >
                  {h.name}{h.city ? <span style={{ color: "var(--muted)" }}> — {h.city}</span> : null}
                </button>
              </li>
            ))}
            {countries.length > 0 && hotels.length > 0 && (
              <li className="px-3 pt-2 pb-1 text-xs uppercase" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>Countries</li>
            )}
            {countries.map((c) => (
              <li key={`co-${c.slug}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hov"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(`/${locale}/cosy-hotels/in/${c.slug}`)}
                >
                  Cosy hotels in {c.name}
                </button>
              </li>
            ))}
            {cities.length > 0 && (hotels.length > 0 || countries.length > 0) && (
              <li className="px-3 pt-2 pb-1 text-xs uppercase" style={{ color: "var(--muted)", letterSpacing: "0.06em" }}>Cities</li>
            )}
            {cities.map((c) => (
              <li key={`c-${c.slug}`}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 hov"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(`/${locale}/guides/${c.slug}-cosy-hotel`)}
                >
                  {c.name}
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

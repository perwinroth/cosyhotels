"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Compact header search — routes to the search results page, which never 404s (a raw
// /guides/{slug} push 404'd for hotel names and cities with no live cosy guide).
export default function HeaderSearch({ locale }: { locale: string }) {
  const [city, setCity] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!city.trim()) return;
        router.push(`/${locale}/search?q=${encodeURIComponent(city.trim())}`);
      }}
      className="ml-auto flex items-center gap-1.5 rounded-lg pr-1 min-w-0"
      style={{ border: "1px solid var(--line)", background: "var(--card)" }}
    >
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Search a city…"
        aria-label="Search a city"
        className="rounded-lg px-3 py-1.5 text-sm bg-transparent focus:outline-none w-32 sm:w-44 min-w-0"
        style={{ color: "var(--foreground)" }}
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex items-center justify-center rounded-md shrink-0 hov"
        style={{ width: 30, height: 30, background: "var(--ember)", color: "#16201C", cursor: "pointer" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
      </button>
    </form>
  );
}

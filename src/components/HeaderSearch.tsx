"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cityToSlug } from "@/lib/citySlug";

// Compact header search — routes to the canonical city guide page.
export default function HeaderSearch({ locale }: { locale: string }) {
  const [city, setCity] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!city.trim()) return;
        router.push(`/${locale}/guides/${cityToSlug(city)}`);
      }}
      className="ml-auto flex items-center gap-1.5 rounded-lg pr-1"
      style={{ border: "1px solid var(--line)", background: "var(--card)" }}
    >
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Search a city…"
        aria-label="Search a city"
        className="rounded-lg px-3 py-1.5 text-sm bg-transparent focus:outline-none w-32 sm:w-44"
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

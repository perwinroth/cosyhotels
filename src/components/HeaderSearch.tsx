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
      className="hidden md:block"
    >
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Search a city…"
        aria-label="Search a city"
        className="rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1"
        style={{ border: "1px solid var(--line)", background: "var(--card)", color: "var(--foreground)", width: 150 }}
      />
    </form>
  );
}

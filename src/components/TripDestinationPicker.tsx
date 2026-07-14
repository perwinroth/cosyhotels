"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// A board destination: a city (or alias) the user might type, and the board slug it routes to.
export type PickerDestination = { label: string; boardSlug: string };

type Props = {
  locale: string;
  destinations: PickerDestination[];
  // Pre-translated labels (the parent server component translates them).
  labels: { prompt: string; placeholder: string; go: string; helper: string };
};

/**
 * Destination selector for /plan. Matches the typed destination against the launch boards' cities
 * (and aliases) and routes INSTANTLY to that board. An unmatched destination routes to site
 * search (the cosiest hotels for any city/country); never opens an email client.
 */
export default function TripDestinationPicker({ locale, destinations, labels }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function match(query: string): string | null {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    // Exact first, then contains, so "bruges" and "brug" both resolve deterministically.
    const exact = destinations.find((d) => d.label.toLowerCase() === needle);
    if (exact) return exact.boardSlug;
    const partial = destinations.find((d) => d.label.toLowerCase().includes(needle) || needle.includes(d.label.toLowerCase()));
    return partial ? partial.boardSlug : null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const slug = match(q);
    if (slug) {
      router.push(`/${locale}/trips/${slug}`);
    } else if (q.trim()) {
      // No launch board for this destination yet: show the cosiest hotels for wherever they typed
      // via site search (handles any city or country, natural phrasing). NEVER open an email client.
      router.push(`/${locale}/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="trip-destination" className="block text-sm font-medium">{labels.prompt}</label>
      <div className="mt-2 flex gap-2">
        <input
          id="trip-destination"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={labels.placeholder}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--card)" }}
        />
        <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--ember)" }}>
          {labels.go}
        </button>
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{labels.helper}</p>
    </form>
  );
}

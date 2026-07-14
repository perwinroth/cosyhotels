"use client";
// Persistent "your collection" entry point in the site header. No login: the collection a visitor
// saved is remembered on THIS device in localStorage ("gc_trip", written by SaveToTripButton). When
// that key holds a slug, we show a link back to it so the visitor can return any time, not only from
// the one-time confirmation shown right after saving. When there is no saved collection on this
// device, this renders nothing (server output is always empty; the link appears after hydration).
import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "gc_trip";

function readSlug(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.slug === "string" ? parsed.slug : null;
  } catch {
    return null;
  }
}

export default function CollectionNavLink({ locale, label }: { locale: string; label: string }) {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(readSlug());
    // Reflect saves/removes made in another tab.
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) setSlug(readSlug()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!slug) return null;

  return (
    <Link
      href={`/${locale}/trips/lists/${slug}`}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium no-underline shrink-0"
      style={{ color: "var(--foreground)" }}
      aria-label={label}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

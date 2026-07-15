"use client";
// Persistent "your collections" entry point in the site header. No login: collections saved on
// THIS device live in localStorage ("gc_collections", written by SaveToTripButton via
// src/lib/collectionStore.ts; legacy single-collection key "gc_trip" is migrated in automatically).
// 0 collections -> renders nothing (server output is always empty; content appears after
// hydration). 1 collection -> the original single link. 2+ -> a small accessible dropdown listing
// every collection, plus a footer link to find collections saved under an email on another device.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { readCollections, type StoredCollection } from "@/lib/collectionStore";

const KEYS = ["gc_collections", "gc_trip"];

type Props = {
  locale: string;
  label: string;
  menuLabel: string;
  defaultTitle: string;
  findByEmailLabel: string;
};

export default function CollectionNavLink({ locale, label, menuLabel, defaultTitle, findByEmailLabel }: Props) {
  const [collections, setCollections] = useState<StoredCollection[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCollections(readCollections());
    const onStorage = (e: StorageEvent) => { if (e.key && KEYS.includes(e.key)) setCollections(readCollections()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (collections.length === 0) return null;

  if (collections.length === 1) {
    const slug = collections[0].slug;
    return (
      <Link
        href={`/${locale}/trips/lists/${slug}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium no-underline shrink-0"
        style={{ color: "var(--foreground)" }}
        aria-label={label}
      >
        <BookmarkIcon />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium"
        style={{ color: "var(--foreground)", background: "transparent", border: "none" }}
      >
        <BookmarkIcon />
        <span className="hidden sm:inline">{menuLabel}</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={menuLabel}
          className="absolute right-0 z-30 mt-2 w-64 max-w-[90vw] rounded-xl border py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}
        >
          <ul>
            {collections.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/${locale}/trips/lists/${c.slug}`}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 no-underline hover:underline"
                  style={{ color: "var(--foreground)" }}
                >
                  {(c.title || "").trim() || defaultTitle}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t px-3 pt-2" style={{ borderColor: "var(--line)" }}>
            <Link
              href={`/${locale}/collections/find`}
              onClick={() => setOpen(false)}
              className="text-xs hover:underline"
              style={{ color: "var(--muted)" }}
            >
              {findByEmailLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

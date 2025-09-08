"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SaveToShortlistButton({ itemSlug, className = "" }: { itemSlug: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const s = window.localStorage.getItem("shortlistSlug");
      if (s) setSlug(s);
      // Check local saved state for this item
      const key = s ? `shortlistItems:${s}` : null;
      if (key) {
        const arr = JSON.parse(window.localStorage.getItem(key) || '[]');
        if (Array.isArray(arr) && arr.includes(itemSlug)) setSaved(true);
      }
    } catch {}
  }, [itemSlug]);

  async function save() {
    setBusy(true);
    try {
      let s = slug;
      if (!s) {
        // Try server API; if unavailable, fall back to a client-generated slug
        try {
          const res = await fetch("/api/shortlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemSlug }) });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data?.slug) {
            s = data.slug as string;
          } else {
            throw new Error(typeof data?.error === 'string' ? data.error : 'Shortlist API not available');
          }
        } catch {
          // Generate a stable local slug
          s = (Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6)).toLowerCase();
        }
        try { if (s) window.localStorage.setItem("shortlistSlug", s); } catch {}
      } else {
        // Best effort server update; continue on failure
        try {
          const res = await fetch(`/api/shortlists/${s}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add: itemSlug }) });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            console.warn(data.error || "Failed to update shortlist (will use local fallback)");
          }
        } catch {}
      }
      // Maintain a local fallback list for this shortlist slug
      try {
        const key = `shortlistItems:${s}`;
        const arr = JSON.parse(window.localStorage.getItem(key) || '[]');
        const next = Array.isArray(arr) ? Array.from(new Set([...arr, itemSlug])) : [itemSlug];
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      // Toast + saved state
      try {
        window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Saved to Shortlist', actionUrl: `/shortlists/${s}`, actionLabel: 'View', type: 'success' } }));
      } catch {}
      setSaved(true);
      if (s) router.push(`/shortlists/${s}`);
    } catch (e) {
      console.error(e);
      alert("Could not save to shortlist. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={save} disabled={busy || saved} type="button" className={className}>
      {busy ? "Saving…" : saved ? "Saved" : "Save to shortlist"}
    </button>
  );
}

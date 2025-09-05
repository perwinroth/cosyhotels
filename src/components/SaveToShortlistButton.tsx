"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SaveToShortlistButton({ itemSlug, className = "" }: { itemSlug: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    try {
      const s = window.localStorage.getItem("shortlistSlug");
      if (s) setSlug(s);
    } catch {}
  }, []);

  async function save() {
    setBusy(true);
    try {
      let s = slug;
      if (!s) {
        const res = await fetch("/api/shortlists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemSlug }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create shortlist");
        s = data.slug;
        try { window.localStorage.setItem("shortlistSlug", s!); } catch {}
      } else {
        const res = await fetch(`/api/shortlists/${s}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ add: itemSlug }) });
        const data = await res.json();
        if (!res.ok) console.warn(data.error || "Failed to update shortlist (will use local fallback)");
      }
      // Maintain a local fallback list for this shortlist slug
      try {
        const key = `shortlistItems:${s}`;
        const arr = JSON.parse(window.localStorage.getItem(key) || '[]');
        const next = Array.isArray(arr) ? Array.from(new Set([...arr, itemSlug])) : [itemSlug];
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      router.push(`/shortlists/${s}`);
    } catch (e) {
      console.error(e);
      alert("Could not save to shortlist. Is the server configured?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={save} disabled={busy} type="button" className={className}>
      {busy ? "Saving…" : "Save to shortlist"}
    </button>
  );
}

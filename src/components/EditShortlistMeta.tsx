"use client";
import { useState } from "react";

export default function EditShortlistMeta({ slug, title }: { slug: string; title?: string }) {
  const [newSlug, setNewSlug] = useState(slug);
  const [newTitle, setNewTitle] = useState(title || "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/shortlists/${slug}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: newTitle }) });
      if (!res.ok) throw new Error("Failed to save title");
      if (newSlug && newSlug !== slug) {
        const r2 = await fetch(`/api/shortlists/${slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newSlug, title: newTitle }) });
        const data = await r2.json();
        if (!r2.ok) throw new Error(data.error || "Failed to rename");
        window.location.href = `/shortlists/${data.slug}`;
      } else {
        window.location.reload();
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not save";
      alert(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input className="border border-zinc-300 rounded px-2 py-1 text-sm" placeholder="Title (optional)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
      <div className="text-sm">URL slug:</div>
      <input className="border border-zinc-300 rounded px-2 py-1 text-sm" value={newSlug} onChange={(e) => setNewSlug(e.target.value.toLowerCase())} />
      <button className="text-sm px-3 py-1.5 rounded border brand-border hover:bg-zinc-50" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

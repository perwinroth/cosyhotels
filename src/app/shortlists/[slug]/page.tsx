import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels as baseHotels } from "@/data/hotels";
import { applyOverrides, fetchOverrides } from "@/lib/overrides";
import { cosyBadgeClass, cosyRankLabel, cosyScore } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";

async function getShortlist(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/shortlists/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function ShortlistPage({ params }: { params: { slug: string } }) {
  const sl = await getShortlist(params.slug);
  const overrides = await fetchOverrides();
  const hotels = applyOverrides(baseHotels, overrides);
  const map = new Map(hotels.map((h) => [h.slug, h]));
  const items: string[] = sl?.items || [];
  const picked = items.map((s) => map.get(s)).filter(Boolean) as typeof hotels;
  const withCosy = picked.map((h) => ({ ...h, _cosy: cosyScore({ rating: h.rating, amenities: h.amenities, description: h.description }) }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Shortlist: {sl?.title || params.slug}</h1>
        <EditShortlistMeta slug={params.slug} title={sl?.title} />
      </div>
      {!sl && (
        <div className="mt-4 text-sm text-zinc-600">Shortlist not found.</div>
      )}
      <div className="mt-6 grid md:grid-cols-3 gap-4 auto-rows-fr">
        {withCosy.map((h) => (
          <Link key={h.slug} href={`/en/hotels/${h.slug}`} className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full">
            <div className="relative aspect-[4/3] bg-zinc-100">
              <Image src={h.image || "/seal.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
              {h._cosy >= 6.5 ? (
                <div className="absolute -left-3 top-4 rotate-[-15deg]">
                  <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
                    <Image src="/seal.svg" alt="seal" width={14} height={14} />
                    <span>Seal of approval</span>
                  </div>
                </div>
              ) : null}
              <div className="absolute left-2 top-2 flex gap-2">
                <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h._cosy)}`}>Cosy {h._cosy.toFixed(1)} · {cosyRankLabel(h._cosy)}</span>
              </div>
              <div className="absolute right-2 top-2 text-xs rounded bg-black/70 text-white px-2 py-0.5">★ {h.rating.toFixed(1)}</div>
            </div>
            <div className="p-3 flex flex-col h-[188px]">
              <div>
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <div className="text-sm text-black">{h.city}</div>
                <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>
              </div>
              <div className="mt-auto pt-4 flex justify-end">
                <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
function EditShortlistMeta({ slug, title }: { slug: string; title?: string }) {
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
    } catch (e: any) {
      alert(e?.message || "Could not save");
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

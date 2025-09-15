"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SearchBar({ locale = "en" }: { locale?: string }) {
  const [city, setCity] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [submitting, setSubmitting] = useState(false);
  // Reset submitting state whenever URL changes (search completes)
  useEffect(() => {
    setSubmitting(false);
  }, [pathname, searchParams]);

  const values = {
    rank: searchParams.get("rank") || "",
    sort: searchParams.get("sort") || "cosy-desc",
    amenities: searchParams.getAll("amenity"),
  };

  function update(next: Partial<typeof values>) {
    const sp = new URLSearchParams(searchParams.toString());
    if ("rank" in next) {
      if (!next.rank) sp.delete("rank"); else sp.set("rank", String(next.rank));
    }
    if ("sort" in next) {
      if (!next.sort) sp.delete("sort"); else sp.set("sort", String(next.sort));
    }
    if ("amenities" in next) {
      sp.delete("amenity");
      (next.amenities || []).forEach((a) => sp.append("amenity", a));
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const amenityOptions = [
    "Spa","Sauna","Rooftop","Garden","Bar","Restaurant","Pool","Pet-friendly","Gym",
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const sp = new URLSearchParams(searchParams.toString());
        if (city) sp.set("city", city); else sp.delete("city");
        setSubmitting(true);
        router.push(`/${locale}/hotels?${sp.toString()}`);
        setOpen(false);
      }}
      className="relative grid md:grid-cols-[1fr_auto_auto] gap-3"
    >
      <input
        className="border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        placeholder="Paris, Rome, Lisbon…"
        value={city}
        onChange={(e) => setCity(e.target.value)}
      />
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg px-4 py-2 border border-zinc-300 hover:bg-zinc-50"
        >
          Filter
        </button>
        {open && (
          <div className="absolute right-0 mt-1 z-30 w-[300px] rounded-lg border border-zinc-200 bg-white shadow p-3">
            <div className="text-sm font-medium mb-2">Sort by</div>
            <div className="flex flex-col gap-1 text-sm mb-3">
              {[
                { label: "Cosy (high → low)", value: "cosy-desc" },
                { label: "Cosy (low → high)", value: "cosy-asc" },
              ].map((s) => (
                <label key={s.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="sort"
                    checked={values.sort === s.value}
                    onChange={() => update({ sort: s.value })}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
            <div className="text-sm font-medium mb-2">Amenities</div>
            <div className="flex flex-wrap gap-2">
              {amenityOptions.map((a) => {
                const active = values.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = new Set(values.amenities);
                      if (active) next.delete(a); else next.add(a);
                      update({ amenities: Array.from(next) });
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-zinc-300 ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-zinc-300 text-black bg-white'}`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 text-right">
              <button type="button" className="text-sm px-3 py-1.5 rounded border brand-border hover:bg-zinc-50" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
      <button
        className="rounded-lg bg-[#0EA5A4] text-white px-4 py-2 hover:bg-[#0B807F] active:translate-y-[1px] active:bg-[#0B807F] disabled:opacity-60 disabled:cursor-not-allowed"
        disabled={submitting}
      >
        {submitting ? "Searching…" : "Search"}
      </button>
    </form>
  );
}

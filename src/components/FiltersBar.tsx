"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

function setParam(sp: URLSearchParams, key: string, value?: string) {
  if (!value) sp.delete(key);
  else sp.set(key, value);
}

export default function FiltersBar({ prepend }: { prepend?: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    return {
      city: searchParams.get("city") || "",
      rank: searchParams.get("rank") || "",
      sort: searchParams.get("sort") || "cosy-desc",
      amenities: searchParams.getAll("amenity"),
    };
  }, [searchParams]);

  function update(next: Partial<typeof values>) {
    const sp = new URLSearchParams(searchParams.toString());
    if ("city" in next) setParam(sp, "city", next.city);
    if ("rank" in next) setParam(sp, "rank", next.rank);
    if ("sort" in next) setParam(sp, "sort", next.sort);
    if ("amenities" in next) {
      sp.delete("amenity");
      (next.amenities || []).forEach((a) => sp.append("amenity", a));
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  const amenityOptions = [
    "Spa",
    "Sauna",
    "Rooftop",
    "Garden",
    "Bar",
    "Restaurant",
    "Pool",
    "Pet-friendly",
    "Gym",
  ];

  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-2 md:p-3 shadow-sm">
      {prepend ? <div className="mb-1">{prepend}</div> : null}
      <div className="grid md:grid-cols-[140px_200px] gap-2 md:gap-2 items-start relative">
        <div className="relative">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-left"
          >
            Filter
          </button>
          {open && (
            <div className="absolute z-30 mt-1 w-[280px] rounded-lg border border-zinc-200 bg-white shadow p-3">
              <div className="text-sm font-medium mb-2">Cosy rank</div>
              <div className="flex flex-col gap-1 text-sm mb-3">
                {[
                  { label: "Any", value: "" },
                  { label: "High", value: "high" },
                  { label: "Mid", value: "mid" },
                  { label: "Low", value: "low" },
                ].map((r) => (
                  <label key={r.value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="rank"
                      checked={values.rank === r.value}
                      onChange={() => update({ rank: r.value })}
                    />
                    <span>{r.label}</span>
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
                      aria-pressed={active}
                      onClick={() => {
                        const next = new Set(values.amenities);
                        if (active) next.delete(a); else next.add(a);
                        update({ amenities: Array.from(next) });
                      }}
                      className={`px-3 py-1.5 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-zinc-300 ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-zinc-300 text-black bg-white'}`}
                      type="button"
                    >
                      {a}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-between">
                <button type="button" className="text-sm underline" onClick={() => { update({ rank: "", amenities: [] }); }}>Clear all</button>
                <button type="button" className="text-sm px-3 py-1.5 rounded border brand-border hover:bg-zinc-50" onClick={() => setOpen(false)}>Close</button>
              </div>
            </div>
          )}
        </div>
        <select
          className="w-full border border-zinc-300 rounded-lg px-3 py-2"
          value={values.sort}
          onChange={(e) => update({ sort: e.target.value })}
        >
          <option value="cosy-desc">Cosy (high → low)</option>
          <option value="rating-desc">Rating (high → low)</option>
          <option value="price-asc">Price (low → high)</option>
          <option value="price-desc">Price (high → low)</option>
        </select>
      </div>
    </div>
  );
}

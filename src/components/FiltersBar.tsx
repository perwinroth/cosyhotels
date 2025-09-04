"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { destinations } from "@/data/hotels";
import { useMemo } from "react";

function setParam(sp: URLSearchParams, key: string, value?: string) {
  if (!value) sp.delete(key);
  else sp.set(key, value);
}

export default function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const values = useMemo(() => {
    return {
      city: searchParams.get("city") || "",
      minRating: searchParams.get("minRating") || "",
      sort: searchParams.get("sort") || "cosy-desc",
      amenities: searchParams.getAll("amenity"),
    };
  }, [searchParams]);

  function update(next: Partial<typeof values>) {
    const sp = new URLSearchParams(searchParams.toString());
    if ("city" in next) setParam(sp, "city", next.city);
    if ("minRating" in next) setParam(sp, "minRating", next.minRating);
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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 md:p-4">
      <div className="grid md:grid-cols-[1fr_140px_200px_auto] gap-2 md:gap-3">
        <div>
          <input
            className="w-full border border-zinc-300 rounded-lg px-3 py-2"
            list="destinations"
            value={values.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="Where to? (e.g., Paris)"
          />
          <datalist id="destinations">
            {destinations.map((d) => (
              <option key={d.slug} value={d.city} />
            ))}
          </datalist>
        </div>
        <select
          className="w-full border border-zinc-300 rounded-lg px-3 py-2"
          value={values.minRating}
          onChange={(e) => update({ minRating: e.target.value })}
        >
          <option value="">Min rating</option>
          <option value="8.5">8.5+</option>
          <option value="9.0">9.0+</option>
          <option value="9.5">9.5+</option>
        </select>
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
        <div className="flex flex-wrap gap-2">
          {amenityOptions.map((a) => {
            const active = values.amenities.includes(a);
            return (
              <button
                key={a}
                onClick={() => {
                  const next = new Set(values.amenities);
                  if (active) next.delete(a); else next.add(a);
                  update({ amenities: Array.from(next) });
                }}
                className={`px-3 py-2 text-sm rounded-full border ${active ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-zinc-300 text-zinc-700 bg-white'}`}
                type="button"
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}


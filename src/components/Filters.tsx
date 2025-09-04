"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { destinations } from "@/data/hotels";
import { useMemo } from "react";

function setParam(sp: URLSearchParams, key: string, value?: string) {
  if (!value) sp.delete(key);
  else sp.set(key, value);
}

export default function Filters() {
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
    "Pool",
    "Rooftop",
    "Pet-friendly",
    "Gym",
    "Bar",
    "Sauna",
    "Bicycles",
    "Restaurant",
    "Garden",
  ];

  return (
    <aside className="md:w-64 w-full md:sticky md:top-16">
      <div className="border border-zinc-200 rounded-xl p-4">
        <h2 className="font-medium mb-3">Filters</h2>

        <label className="block text-sm mb-3">
          <span className="block text-zinc-600 mb-1">Destination</span>
          <input
            className="w-full border border-zinc-300 rounded-lg px-3 py-2"
            list="destinations"
            value={values.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="City"
          />
          <datalist id="destinations">
            {destinations.map((d) => (
              <option key={d.slug} value={d.city} />
            ))}
          </datalist>
        </label>

        <label className="block text-sm mb-3">
          <span className="block text-zinc-600 mb-1">Min rating</span>
          <select
            className="w-full border border-zinc-300 rounded-lg px-3 py-2"
            value={values.minRating}
            onChange={(e) => update({ minRating: e.target.value })}
          >
            <option value="">Any</option>
            <option value="8.5">8.5+</option>
            <option value="9.0">9.0+</option>
            <option value="9.5">9.5+</option>
          </select>
        </label>

        <div className="text-sm mb-3">
          <div className="text-zinc-600 mb-1">Amenities</div>
          <div className="grid grid-cols-2 gap-2">
            {amenityOptions.map((a) => {
              const checked = values.amenities.includes(a);
              return (
                <label key={a} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(values.amenities);
                      if (e.target.checked) next.add(a);
                      else next.delete(a);
                      update({ amenities: Array.from(next) });
                    }}
                  />
                  <span>{a}</span>
                </label>
              );
            })}
          </div>
        </div>

        <label className="block text-sm mb-1">
          <span className="block text-zinc-600 mb-1">Sort</span>
          <select
            className="w-full border border-zinc-300 rounded-lg px-3 py-2"
            value={values.sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="cosy-desc">Cosy (high → low)</option>
            <option value="relevance">Relevance</option>
            <option value="rating-desc">Rating (high → low)</option>
            <option value="price-asc">Price (low → high)</option>
            <option value="price-desc">Price (high → low)</option>
          </select>
        </label>
      </div>
    </aside>
  );
}

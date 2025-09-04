import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels, destinations } from "@/data/hotels";
import { SearchBar } from "@/components/HomeSections";
import { Suspense } from "react";
import Filters from "@/components/Filters";

type Props = { locale: string };

function Tile({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl border border-zinc-200 overflow-hidden bg-white hover:shadow-sm transition-shadow ${className}`} style={style}>
      {children}
    </div>
  );
}

export default function HomeGrid({ locale }: Props) {
  const featured = hotels.filter(h => h.featured).concat(hotels).slice(0, 8);
  const topDest = destinations.slice(0, 6);
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 [--row:120px] md:auto-rows-[var(--row)]">
      {/* HERO: big headline + search (span 8x3 on md) */}
      <Tile className="p-6 md:p-8" style={{ gridColumn: 'span 12', gridRow: 'span 3' }}>
        <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">Find cosy hotel rooms</h1>
        <p className="mt-3 text-zinc-600 max-w-2xl">Discover warm, characterful boutique stays worldwide — handpicked for comfort.</p>
        <div className="mt-6 max-w-3xl">
          <SearchBar locale={locale} />
        </div>
        <div className="mt-3 text-sm text-zinc-600">
          <Link href={`/${locale}/hotels`} className="underline">Browse all</Link>
        </div>
      </Tile>

      {/* FILTERS: dedicated tile (span 4x3 on md) */}
      <Tile className="p-4 md:p-5" style={{ gridColumn: 'span 12', gridRow: 'span 3' }}>
        <h2 className="text-lg font-medium">Refine your search</h2>
        <div className="mt-3">
          <Suspense fallback={<div className="text-sm text-zinc-500">Loading filters…</div>}>
            <Filters basePath={`/${locale}/hotels`} />
          </Suspense>
        </div>
      </Tile>

      {/* DESTINATIONS: three tiles (span 4x2 each) */}
      {topDest.slice(0, 3).map((d) => (
        <Tile key={d.slug} style={{ gridColumn: 'span 12', gridRow: 'span 2' }}>
          <Link href={`/${locale}/hotels?city=${encodeURIComponent(d.city)}`} className="block">
            <div className="aspect-[4/3] md:aspect-auto md:h-[calc(var(--row)*2-1rem)] bg-zinc-100 flex items-end p-3">
              <div className="text-sm font-medium">{d.city}</div>
            </div>
          </Link>
        </Tile>
      ))}

      {/* COSY EXPLAINER (span 6x2) */}
      <Tile className="p-5 bg-zinc-50" style={{ gridColumn: 'span 12', gridRow: 'span 2' }}>
        <h3 className="font-medium">What is the Cosy score?</h3>
        <p className="text-sm text-zinc-600 mt-1">
          A transparent blend of rating, amenities warmth, language, and scale to estimate how cosy a place feels.
        </p>
        <Link href={`/${locale}/cosy-score`} className="inline-block mt-3 text-sm underline">Learn more</Link>
      </Tile>

      {/* FEATURED BIG (span 6x3) */}
      {featured.slice(0,1).map((h) => (
        <Tile key={h.slug} style={{ gridColumn: 'span 12', gridRow: 'span 3' }}>
          <Link href={`/${locale}/hotels/${h.slug}`} className="block">
            <div className="relative md:h-[calc(var(--row)*2)] bg-zinc-100">
              <Image src="/hotel-placeholder.svg" alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <span className="text-xs rounded bg-zinc-100 text-zinc-700 px-2 py-0.5">{h.rating.toFixed(1)}</span>
              </div>
              <div className="text-sm text-zinc-600">{h.city}</div>
              <div className="mt-2 text-sm text-zinc-700">From ${h.price}/night</div>
            </div>
          </Link>
        </Tile>
      ))}

      {/* FEATURED SMALL (span 3x2 each) */}
      {featured.slice(1,5).map((h) => (
        <Tile key={h.slug} style={{ gridColumn: 'span 12', gridRow: 'span 2' }}>
          <Link href={`/${locale}/hotels/${h.slug}`} className="block">
            <div className="relative md:h-[calc(var(--row)*1.2)] bg-zinc-100">
              <Image src="/hotel-placeholder.svg" alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} />
            </div>
            <div className="p-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium line-clamp-1">{h.name}</h3>
                <span className="text-xs rounded bg-zinc-100 text-zinc-700 px-2 py-0.5">{h.rating.toFixed(1)}</span>
              </div>
              <div className="text-sm text-zinc-600">{h.city}</div>
            </div>
          </Link>
        </Tile>
      ))}

      {/* SECOND DESTINATION ROW (optional) */}
      {topDest.slice(3,6).map((d) => (
        <Tile key={d.slug} style={{ gridColumn: 'span 12', gridRow: 'span 2' }}>
          <Link href={`/${locale}/hotels?city=${encodeURIComponent(d.city)}`} className="block">
            <div className="aspect-[4/3] md:aspect-auto md:h-[calc(var(--row)*2-1rem)] bg-zinc-100 flex items-end p-3">
              <div className="text-sm font-medium">{d.city}</div>
            </div>
          </Link>
        </Tile>
      ))}

      {/* COLLECTIONS CTA (span full) */}
      <Tile className="p-5" style={{ gridColumn: 'span 12', gridRow: 'span 2' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Explore curated collections</h3>
            <p className="text-sm text-zinc-600">Themes to inspire cosy getaways.</p>
          </div>
          <Link href={`/${locale}/collections`} className="text-sm underline">View collections</Link>
        </div>
      </Tile>
    </div>
  );
}

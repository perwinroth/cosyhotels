import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { hotels, destinations } from "@/data/hotels";
import { SearchBar } from "@/components/HomeSections";

type Props = { locale: string };

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-200 overflow-hidden ${className}`}>{children}</div>
  );
}

export default function HomeGrid({ locale }: Props) {
  const featured = hotels.filter(h => h.featured).concat(hotels).slice(0, 6);
  const topDest = destinations.slice(0, 6);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-[1fr]">
      {/* Search tile (large) */}
      <Tile className="col-span-2 md:col-span-4 p-4 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Find cosy hotel rooms</h2>
            <p className="text-sm text-zinc-600 mt-1">Discover warm, characterful boutique stays worldwide.</p>
          </div>
        </div>
        <div className="mt-4">
          <SearchBar locale={locale} />
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          <Link className="underline" href={`/${locale}/hotels`}>Browse all</Link>
        </div>
      </Tile>

      {/* Destination tiles */}
      {topDest.map((d) => (
        <Tile key={d.slug} className="bg-white">
          <Link href={`/${locale}/hotels?city=${encodeURIComponent(d.city)}`} className="block">
            <div className="aspect-[4/3] bg-zinc-100 flex items-end p-3">
              <div className="text-sm font-medium">{d.city}</div>
            </div>
          </Link>
        </Tile>
      ))}

      {/* Cosy explainer tile */}
      <Tile className="col-span-2 md:col-span-2 p-4 bg-zinc-50">
        <h3 className="font-medium">What is the Cosy score?</h3>
        <p className="text-sm text-zinc-600 mt-1">
          A transparent blend of rating, amenities warmth, language, and scale to estimate how cosy a place feels.
        </p>
        <Link href={`/${locale}/cosy-score`} className="inline-block mt-3 text-sm underline">Learn more</Link>
      </Tile>

      {/* Featured hotels */}
      {featured.map((h) => (
        <Tile key={h.slug} className="bg-white">
          <Link href={`/${locale}/hotels/${h.slug}`} className="block">
            <div className="relative aspect-[4/3] bg-zinc-100">
              <Image
                src="/hotel-placeholder.svg"
                alt={`${h.name} – ${h.city}`}
                fill
                className="object-cover"
                placeholder="blur"
                blurDataURL={shimmer(1200, 800)}
              />
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

      {/* CTA tile */}
      <Tile className="col-span-2 md:col-span-4 p-4 bg-white">
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


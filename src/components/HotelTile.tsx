import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { cosyBadgeClass, cosyRankLabel } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";

export type TileHotel = {
  slug: string;
  name: string;
  city: string;
  rating: number;
  price?: number;
  image?: string; // resolved URL
  cosy: number;   // computed 0..10
};

export default function HotelTile({ hotel, href }: { hotel: TileHotel; href: string }) {
  const h = hotel;
  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full"
      aria-label={`${h.name}, cosy score ${h.cosy.toFixed(1)} out of 10`}
      data-cosy={h.cosy.toFixed(1)}
    >
      <div className="relative aspect-[4/3] bg-zinc-100">
        <Image src={h.image || "/hotel-placeholder.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px" />
        {h.cosy >= 6.5 ? (
          <div className="absolute -left-3 top-4 rotate-[-15deg]">
            <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
              <Image src="/seal.svg" alt="seal" width={14} height={14} />
              <span>Seal of approval</span>
            </div>
          </div>
        ) : null}
        <div className="absolute left-2 top-2 flex gap-2">
          <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h.cosy)}`}>
            Cosy {h.cosy.toFixed(1)} · {cosyRankLabel(h.cosy)}
          </span>
        </div>
        <div className="absolute right-2 top-2 text-xs rounded bg-black/70 text-white px-2 py-0.5">★ {h.rating.toFixed(1)}</div>
      </div>
      <div className="p-3 flex flex-col h-[188px]">
        <div>
          <h3 className="font-medium line-clamp-1">{h.name}</h3>
          <div className="text-sm text-black">{h.city}</div>
          {h.price != null && <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>}
        </div>
        <div className="mt-auto pt-4 flex justify-end">
          <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
        </div>
      </div>
    </Link>
  );
}


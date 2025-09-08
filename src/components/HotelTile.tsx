"use client";
import Link from "next/link";
import Image from "next/image";
import { shimmer } from "@/lib/image";
import { cosyBadgeClass } from "@/lib/scoring/cosy";
import SaveToShortlistButton from "@/components/SaveToShortlistButton";
import { useRouter } from "next/navigation";

export type TileHotel = {
  slug: string;
  name: string;
  city: string;
  rating: number;
  price?: number;
  image?: string; // resolved URL
  cosy: number;   // computed 0..10
};

export default function HotelTile({ hotel, href, goHref }: { hotel: TileHotel; href: string; goHref?: string }) {
  const h = hotel;
  const cosyText = h.cosy.toFixed(1);
  const router = useRouter();

  function openDetails() {
    router.push(href);
  }

  function keyOpen(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDetails();
    }
  }
  return (
    <div
      className="overflow-hidden rounded-2xl border brand-border hover:shadow-md bg-white h-full cursor-pointer"
      aria-label={`${h.name}, Cosy ${cosyText}`}
      data-cosy={cosyText}
      role="link"
      tabIndex={0}
      onClick={openDetails}
      onKeyDown={keyOpen}
    >
      <div className="relative aspect-[4/3] bg-zinc-100">
        <Image src={h.image || "/hotel-placeholder.svg"} alt={`${h.name} – ${h.city}`} fill className="object-cover" placeholder="blur" blurDataURL={shimmer(1200, 800)} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px" />
        {h.cosy >= 7.0 ? (
          <div className="absolute left-2 bottom-2">
            <div className="flex items-center gap-1 bg-emerald-600 text-white text-xs px-3 py-1 rounded-full shadow">
              <Image src="/seal.svg" alt="Seal of approval" width={14} height={14} />
              <span>Seal of approval</span>
            </div>
          </div>
        ) : null}
        <div className="absolute right-2 top-2 flex gap-2">
          <span className={`text-xs rounded px-2 py-0.5 ${cosyBadgeClass(h.cosy)}`} title={`Cosy ${cosyText}`}>
            Cosy {cosyText}
          </span>
        </div>
      </div>
      <div className="p-3 flex flex-col h-[188px]">
        <div>
          <h3 className="font-medium line-clamp-1">{h.name}</h3>
          <div className="text-sm text-black">{h.city}</div>
          {h.price != null && <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>}
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Link href={href} onClick={(e) => e.stopPropagation()} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50">Details</Link>
            {goHref && (
              <a href={goHref} onClick={(e) => e.stopPropagation()} target="_blank" rel="noopener nofollow sponsored" className="text-sm px-3 py-1.5 rounded-full border brand-border bg-zinc-900 text-white hover:bg-zinc-800">Visit site</a>
            )}
          </div>
          <span onClick={(e) => e.stopPropagation()}>
            <SaveToShortlistButton itemSlug={h.slug} className="text-sm px-3 py-1.5 rounded-full border brand-border hover:bg-zinc-50" />
          </span>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { shimmer, placeholderUrl } from "@/lib/image";

export type TileHotel = {
  slug: string;
  name: string;
  city: string;
  country?: string;
  rating: number;
  price?: number;
  image?: string; // resolved URL
  cosy: number;   // computed 0..10
};

export default function HotelTile({ hotel, href, goHref, priority = false, sizes = "(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px" }: { hotel: TileHotel; href: string; goHref?: string; priority?: boolean; sizes?: string }) {
  const h = hotel;
  const cosyText = h.cosy.toFixed(1);
  const raw = h.image || placeholderUrl;
  const isRemote = /^https?:\/\//.test(raw);
  const src = isRemote ? `/api/proxy/image?url=${encodeURIComponent(raw)}` : raw;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card h-full transition-transform duration-200 hover:-translate-y-1" style={{ borderColor: 'var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)' }} aria-label={`${h.name}, Cosy ${cosyText}`} data-cosy={cosyText}>
      <Link href={href} className="relative aspect-[4/3] block" style={{ background: 'var(--surface-2)' }}>
        <Image
          src={src}
          alt={`${h.name} – ${h.city}`}
          fill
          className="object-cover"
          placeholder="blur"
          priority={priority}
          blurDataURL={shimmer(1200, 800)}
          sizes={sizes}
          unoptimized={false}
        />
        {h.cosy >= 7.8 && !/placehold/.test(raw) ? (
          <div className="absolute left-2 bottom-2">
            <div className="flex items-center gap-1.5 text-white text-xs px-3 py-1 rounded-full shadow" style={{ background: 'var(--sage)' }}>
              <Image src="/seal.svg" alt="Seal of Approval" width={15} height={15} />
              <span className="font-medium">Seal of Approval</span>
            </div>
          </div>
        ) : null}
        <div className="absolute right-2 top-2">
          <span className="inline-flex items-center justify-center text-white font-semibold rounded-full shadow" style={{ background: cosyDotColor(h.cosy), width: 42, height: 42, fontFamily: 'Fraunces, serif', fontSize: 15 }} title={`Cosy ${cosyText}`}>
            {cosyText}
          </span>
        </div>
      </Link>
      <div className="p-3.5 flex flex-col h-[188px]">
        <div>
          <h3 className="font-display font-medium text-[17px] leading-tight line-clamp-1">
            <Link href={href} className="no-underline hover:underline">{h.name}</Link>
          </h3>
          <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>{h.city}{h.country ? `, ${h.country}` : ""}</div>
          {h.price != null && <div className="mt-3 text-sm font-medium brand-price">From ${h.price}/night</div>}
        </div>
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Link href={href} className="text-sm px-3.5 py-1.5 rounded-full border no-underline hover:bg-[#f3ebde]" style={{ borderColor: 'var(--line)' }}>Details</Link>
            {goHref && (
              <a
                href={goHref}
                target="_blank"
                rel="noopener nofollow sponsored"
                className="text-sm px-3.5 py-1.5 rounded-full text-white !text-white no-underline border border-transparent"
                style={{ background: 'var(--ember)' }}
              >
                Visit site
              </a>
            )}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}

// Cosy score badge color — warm sage (cosy) down to muted clay (mild)
function cosyDotColor(score: number): string {
  if (score >= 7.8) return '#5c6b56'; // sage — very cosy
  if (score >= 6.8) return '#7c8a5f'; // olive — cosy
  if (score >= 5.6) return '#b07a4a'; // warm clay
  return '#a89b8c'; // muted — mild
}

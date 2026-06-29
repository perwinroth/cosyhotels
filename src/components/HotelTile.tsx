import Link from "next/link";
import Image from "next/image";
import { cosyBadgeColor } from "@/lib/cosyColor";

export type TileHotel = {
  slug: string;
  name: string;
  city: string;
  country?: string;
  rating: number;
  price?: number;
  image?: string; // resolved URL — kept for caller compatibility, not rendered
  cosy: number;   // computed 0..10
  description?: string;
  signals?: string[];
};

export default function HotelTile({ hotel, href, goHref }: { hotel: TileHotel; href: string; goHref?: string; priority?: boolean; sizes?: string }) {
  const h = hotel;
  const cosyText = h.cosy.toFixed(1);
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-card h-full transition-transform duration-200 hover:-translate-y-1 flex flex-col"
      style={{ borderColor: 'var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)' }}
      aria-label={`${h.name}, Cosy ${cosyText}`}
      data-cosy={cosyText}
    >
      {/* Score header */}
      <div className="px-4 pt-5 pb-3 flex items-start gap-3">
        <div
          className="flex-shrink-0 flex items-center justify-center rounded-2xl shadow"
          style={{ background: cosyBadgeColor(h.cosy), width: 64, height: 64 }}
        >
          <span
            style={{ fontFamily: 'Fraunces, serif', fontSize: 26, color: '#fff', lineHeight: 1, fontWeight: 600 }}
            title={`Cosy ${cosyText}`}
          >
            {cosyText}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-medium text-[17px] leading-tight line-clamp-1">
            <Link href={href} className="no-underline hover:underline">{h.name}</Link>
          </h3>
          <div className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
            {h.city}{h.country ? `, ${h.country}` : ""}
          </div>
          {h.cosy >= 7.8 && (
            <div className="mt-1.5 inline-flex items-center gap-1 text-white text-xs px-2.5 py-0.5 rounded-full" style={{ background: 'var(--sage)' }}>
              <Image src="/seal.svg" alt="Seal of Approval" width={13} height={13} />
              <span className="font-medium">Seal of Approval</span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {h.description && (
        <div className="px-4 pb-2 text-sm leading-snug line-clamp-2" style={{ color: 'var(--muted)' }}>
          {h.description}
        </div>
      )}

      {/* Signal chips */}
      {h.signals && h.signals.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {h.signals.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ borderColor: 'var(--line)', color: 'var(--muted)', background: 'var(--surface-2)' }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Price */}
      {h.price != null && (
        <div className="px-4 pb-2 text-sm font-medium brand-price">From ${h.price}/night</div>
      )}

      {/* Actions */}
      <div className="mt-auto px-4 pb-4 pt-2 flex items-center gap-2">
        <Link
          href={href}
          className="text-sm px-3.5 py-1.5 rounded-full border no-underline hover:bg-[#f3ebde]"
          style={{ borderColor: 'var(--line)' }}
        >
          Details
        </Link>
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
    </div>
  );
}

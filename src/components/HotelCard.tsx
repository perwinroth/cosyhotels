// ONE shared hotel-card treatment for every list surface (mobile UX P2, founder rule: global
// updates, never per-page patches; see die-validation memory/findings/mobile-ux-plan-2026-07-17.md).
// Before this component, six-plus surfaces hand-rolled the same card, so a design fix (e.g. #115's
// mobile score chip) had to be re-applied N times and a new surface started from whichever old copy
// it was pasted from. The collection page (trips/lists/[slug]) regressed exactly this way (always
// visible left badge dead column on mobile, unstacked actions, a floating Remove control) because it
// was never touched by the earlier per-page passes. Extract once, use everywhere.
//
// Anatomy (server component; composes the client SaveToTripButton + ShareButton via HotelActions):
//   MOBILE (<sm):  [score chip 7.6 COSY] [#rank if passed] [Hotel name, wraps]
//                  City, Country
//                  snippet (clampSnippet controls 2-line vs full)
//                  HotelActions (full-width stacked buttons) + extraActions
//   DESKTOP (sm+): 56px badge block left, text column, optional photo right: the look every
//                  facet/city/country/region/guide/blog card already shared.
// Rank digits ONLY when `rank` is passed (sequence is information on ranked lists; curated sections
// like the homepage "Cosy stays we love" pass no rank, per P1, PR #134). The score chip is the same
// shape everywhere: rounded-lg, cosyBadgeColor background, number + tiny "COSY" label, first in the
// title row on mobile, never a dead left column.
import Image from "next/image";
import type { ReactNode } from "react";
import HotelActions from "@/components/HotelActions";
import type { SaveToTripLabels } from "@/components/SaveToTripButton";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { displayCity, displayCountry } from "@/lib/placeText";

export type HotelCardProps = {
  slug: string;
  name: string;
  /** Raw or already-normalized city/country; displayCity/displayCountry run here regardless, so
   *  this is the single choke point for the "Sverige" leak class of bug. */
  city?: string | null;
  country?: string | null;
  score: number;
  snippet?: string | null;
  /** true → 2-line clamp (homepage, search); false (default) → full snippet, e.g. the collection
   *  page's deliberate full-length SEO description. */
  clampSnippet?: boolean;
  /** 1-based. Only ranked lists (search, "cosiest in X") pass this; curated sections never do. */
  rank?: number;
  /** Vetted (vision_ok) photo URL. Desktop-only, hidden on mobile, same as today's facet-card look. */
  photo?: string | null;
  locale: string;
  saveLabels: SaveToTripLabels;
  stay22Href: string;
  website?: string | null;
  isVerifiedWrong?: boolean;
  shareTitle?: string;
  shareUrl?: string;
  /** Extra controls rendered in the SAME actions column as HotelActions (e.g. the collection page's
   *  Remove button); never a separately floated element (the #132-class regression). */
  extraActions?: ReactNode;
  /** e.g. "Why it's cosy" (search, guides) / "Why it's here" (blog). Omit for surfaces with no
   *  eyebrow label (facet/country/region/adaptive-reuse/homepage). */
  snippetEyebrow?: string;
};

export default function HotelCard({
  slug, name, city, country, score, snippet, clampSnippet = false, rank, photo, locale,
  saveLabels, stay22Href, website, isVerifiedWrong, shareTitle, shareUrl, extraActions, snippetEyebrow,
}: HotelCardProps) {
  const place = [displayCity(city), displayCountry(country)].filter(Boolean).join(", ");
  const detailsHref = `/${locale}/hotels/${slug}`;
  const scoreLabel = score.toFixed(1);
  const snippetClass = `mt-0.5 text-sm leading-relaxed${clampSnippet ? " line-clamp-2" : ""}`;

  return (
    <li className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <div className="flex items-start gap-4">
        {/* Desktop badge block, hidden on mobile so it is never a dead left column. */}
        <div
          className="flex-shrink-0 hidden sm:flex items-center justify-center rounded-2xl text-white shadow"
          style={{ background: cosyBadgeColor(score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}
        >
          {scoreLabel}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mobile score chip, always first in the title row, always the same shape. */}
            <span
              className="sm:hidden inline-flex items-center rounded-lg px-2 py-0.5 text-sm font-display font-bold text-white"
              style={{ background: cosyBadgeColor(score) }}
            >
              {scoreLabel}
              <span style={{ fontFamily: "Inter", fontSize: 8, fontWeight: 600, letterSpacing: "0.12em", opacity: 0.8, marginLeft: 3 }}>COSY</span>
            </span>
            {typeof rank === "number" && (
              <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{rank}</span>
            )}
            <h3 className="text-lg font-semibold leading-tight">
              <a href={detailsHref} className="hover:underline">{name}</a>
            </h3>
          </div>
          {place && <div className="text-sm" style={{ color: "var(--muted)" }}>{place}</div>}
          {snippet && (
            snippetEyebrow ? (
              <div className="mt-2">
                <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{snippetEyebrow}</span>
                <p className={snippetClass} style={{ color: "var(--foreground)" }}>{snippet}</p>
              </div>
            ) : (
              <p className={`mt-2 text-sm leading-relaxed${clampSnippet ? " line-clamp-2" : ""}`} style={{ color: "var(--foreground)" }}>{snippet}</p>
            )
          )}
          <HotelActions
            stay22Href={stay22Href}
            website={website}
            isVerifiedWrong={!!isVerifiedWrong}
            hotelName={name}
            city={city || undefined}
            slug={slug}
            locale={locale}
            saveLabels={saveLabels}
            shareTitle={shareTitle}
            shareUrl={shareUrl}
          />
          {extraActions}
        </div>
        {photo && (
          <a href={detailsHref} className="flex-shrink-0 hidden sm:block">
            <div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}>
              <Image src={photo} alt={name} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(photo)} />
            </div>
          </a>
        )}
      </div>
    </li>
  );
}

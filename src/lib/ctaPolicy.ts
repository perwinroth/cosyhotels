// Single source of truth for the booking-CTA decision (founder, 2026-07-16): every listing card
// and the hotel detail page must apply the IDENTICAL rule, so it stays measurable (data-cta) and
// never drifts surface-to-surface. See src/lib/delisted.ts isRealHotelWebsite for the sweep
// evidence (59% exact / 36% city-search / 4% wrong-hotel) behind the rule itself.
import { isRealHotelWebsite } from "@/lib/delisted";

export type BookingCta = {
  mode: "website" | "stay22";
  href: string;
  /** English source string; callers translate() it for non-en locales, same as every other
   *  reader-facing string in this codebase. */
  label: string;
  dataCta: "hotel_website" | "check_nearby";
  rel: string;
};

/**
 * Resolve the single booking CTA for a hotel: its own real website when it has one (no Stay22
 * button at all for that hotel), else the Stay22 "roam" link relabeled to describe what it
 * truthfully does (a nearby-stays search, not a guaranteed exact-hotel match).
 */
export function resolveBookingCta(website: string | null | undefined, stay22Href: string): BookingCta {
  if (isRealHotelWebsite(website)) {
    return {
      mode: "website",
      href: String(website).trim(),
      label: "Visit hotel website",
      dataCta: "hotel_website",
      rel: "noopener nofollow",
    };
  }
  return {
    mode: "stay22",
    href: stay22Href,
    label: "Check nearby stays",
    dataCta: "check_nearby",
    rel: "noopener nofollow sponsored",
  };
}

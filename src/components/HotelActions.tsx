// Shared hotel action row (booking CTA + Save + Share). One component so every public
// listing/guide/detail page renders the SAME wrap-safe, touch-friendly control group.
//
// Layout (founder-chosen):
//   • mobile  → full-width stacked: all controls are full-width buttons stacked, so they read as
//               one consistent column (founder, 2026-07-15).
//   • >= sm   → a single inline row (wrap allowed) so it never overflows the card or the viewport.
// Every control is >= 44px tall and shares the rounded-xl radius family, so the row reads as one
// system. This is a server component: it composes the client SaveToTripButton + ShareButton and
// awaits translate() itself, so callers only ever pass English source data.
//
// Booking CTA policy (founder, 2026-07-16, supersedes the PR #120 "always primary Stay22, website
// purely additive" note): a real-browser sweep showed Stay22's "Check availability" link lands on
// the exact hotel only ~59% of the time, ~36% on a generic city search, ~4% on a DIFFERENT hotel.
// So there is now exactly ONE primary booking button: the hotel's own website when it has one (no
// Stay22 button at all for that hotel), else Stay22 relabeled "Check nearby stays" (what it
// truthfully does). Decision + label are centralized in src/lib/ctaPolicy.ts resolveBookingCta so
// every surface applies the identical rule.
import ShareButton from "@/components/ShareButton";
import SaveToTripButton, { type SaveToTripLabels } from "@/components/SaveToTripButton";
import { resolveBookingCta } from "@/lib/ctaPolicy";
import { translate } from "@/lib/i18n/translate";

type Props = {
  /** Stay22 "Check availability" deep link — the fallback CTA when the hotel has no real website. */
  stay22Href: string;
  hotelName: string;
  city?: string;
  slug: string;
  locale: string;
  saveLabels: SaveToTripLabels;
  /** When omitted, the Share control is not rendered (e.g. the detail page shares from its header). */
  shareTitle?: string;
  shareUrl?: string;
  /** Raw stored hotel.website value, unsanitized — resolveBookingCta validates + OTA-filters it. */
  website?: string | null;
};

export default async function HotelActions({ stay22Href, hotelName, city, slug, locale, saveLabels, shareTitle, shareUrl, website }: Props) {
  const cta = resolveBookingCta(website, stay22Href);
  const label = locale === "en" ? cta.label : await translate(cta.label, locale);
  return (
    <div className="mt-3 flex w-full max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <a
        href={cta.href}
        target="_blank"
        rel={cta.rel}
        data-cta={cta.dataCta}
        data-hotel={hotelName}
        data-city={city}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-white no-underline sm:w-auto"
        style={{ background: "var(--ember)" }}
      >
        {label}
      </a>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <SaveToTripButton variant="compact" block hotelSlug={slug} locale={locale} labels={saveLabels} />
        {shareTitle ? <ShareButton variant="icon" block title={shareTitle} url={shareUrl} /> : null}
      </div>
    </div>
  );
}

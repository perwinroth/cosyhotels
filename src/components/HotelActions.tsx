// Shared hotel action row (Check availability [+ Visit hotel website] + Save + Share). One
// component so every public listing/guide/detail page renders the SAME wrap-safe, touch-friendly
// control group.
//
// Layout (founder-chosen):
//   • mobile  → full-width stacked: all controls are full-width buttons stacked, so they read as
//               one consistent column (founder, 2026-07-15).
//   • >= sm   → a single inline row (wrap allowed) so it never overflows the card or the viewport.
// Every control is >= 44px tall and shares the rounded-xl radius family, so the row reads as one
// system. This is a server component: it composes the client SaveToTripButton + ShareButton and
// awaits translate() itself, so callers only ever pass English source data.
//
// Booking CTA policy (founder FINAL rule, 2026-07-16 — supersedes an earlier same-day draft that
// made the website primary everywhere): Stay22 "Check availability" is the DEFAULT primary CTA on
// every surface, exactly as it was before this branch, UNLESS the hotel's Stay22 landing has been
// VERIFIED wrong by the real-browser sweep (isVerifiedWrong — see src/lib/ctaPolicy.ts
// getStay22WrongSlugs), in which case the decision swaps per resolveBookingCta. Separately, and
// unconditionally of the sweep, PR #120's ADDITIVE "Visit hotel website" secondary button (revenue
// call, 2026-07-16: Stay22 never demoted, website purely additive beside it) is preserved — opt in
// per call site via showWebsiteSecondary, which today only the hotel detail page sets.
import ShareButton from "@/components/ShareButton";
import SaveToTripButton, { type SaveToTripLabels } from "@/components/SaveToTripButton";
import { resolveBookingCta } from "@/lib/ctaPolicy";
import { isRealHotelWebsite } from "@/lib/delisted";
import { translate } from "@/lib/i18n/translate";

type Props = {
  /** Stay22 "Check availability" deep link — the default CTA, and the fallback CTA (relabelled)
   *  for a verified-wrong hotel with no real website. */
  stay22Href: string;
  hotelName: string;
  city?: string;
  slug: string;
  locale: string;
  saveLabels: SaveToTripLabels;
  /** When omitted, the Share control is not rendered (e.g. the detail page shares from its header). */
  shareTitle?: string;
  shareUrl?: string;
  /** Raw stored hotel.website value, unsanitized — resolveBookingCta/isRealHotelWebsite validate +
   *  OTA-filter it. */
  website?: string | null;
  /** True only for a hotel whose Stay22 landing has been VERIFIED wrong by the real-browser sweep
   *  (verdict WRONG_PROPERTY, CITY_SEARCH or UNMATCHED_SEARCH). Defaults to false: a hotel with no
   *  verdict row, or verdict PENDING/EXACT/SELECTED, always renders the untouched default CTA. */
  isVerifiedWrong?: boolean;
  /** Detail-page-only (PR #120): when true, and this hotel is NOT verified-wrong, and it has a real
   *  website, also render that website as an ADDITIVE secondary button beside the primary Stay22
   *  button. Listing cards never set this — the additive button only ever shipped on the detail page. */
  showWebsiteSecondary?: boolean;
};

export default async function HotelActions({ stay22Href, hotelName, city, slug, locale, saveLabels, shareTitle, shareUrl, website, isVerifiedWrong, showWebsiteSecondary }: Props) {
  const cta = resolveBookingCta(website, stay22Href, !!isVerifiedWrong);
  const label = locale === "en" ? cta.label : await translate(cta.label, locale);
  // Additive secondary (PR #120, preserved): only beside the untouched default primary, only where
  // the caller opted in, and only when the hotel genuinely has a real, non-OTA website.
  const showSecondary = !!showWebsiteSecondary && cta.dataCta === "check_availability" && isRealHotelWebsite(website);
  const secondaryLabel = showSecondary ? (locale === "en" ? "Visit hotel website" : await translate("Visit hotel website", locale)) : null;
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
      {showSecondary && (
        <a
          href={String(website).trim()}
          target="_blank"
          rel="noopener nofollow"
          data-cta="hotel_website"
          data-hotel={hotelName}
          data-city={city}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium no-underline sm:w-auto"
          style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}
        >
          {secondaryLabel}
        </a>
      )}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <SaveToTripButton variant="compact" block hotelSlug={slug} locale={locale} labels={saveLabels} />
        {shareTitle ? <ShareButton variant="icon" block title={shareTitle} url={shareUrl} /> : null}
      </div>
    </div>
  );
}

// Shared hotel action row (Check availability [+ Visit hotel website] + Save + Share). One
// component so every public listing/guide/detail page renders the SAME wrap-safe, touch-friendly
// control group.
//
// Layout (founder-chosen):
//   • mobile  → full-width stacked: all controls are full-width buttons stacked, so they read as
//               one consistent column (founder, 2026-07-15).
//   • >= sm   → a single inline row (wrap allowed) so it never overflows the card or the viewport.
// Every control is >= 44px tall and shares the rounded-xl radius family, so the row reads as one
// system. This is a server component: it merely composes the client SaveToTripButton + ShareButton.
//
// "Check availability" (Stay22) is ALWAYS primary — per founder spec (revenue call, 2026-07-16) it
// is never demoted or reordered, affiliate revenue depends on it. "Visit hotel website" is purely
// additive: a secondary/outline button shown BESIDE it only when the hotel row carries a
// sanitized website URL (src/lib/delisted.ts isValidWebsiteUrl).
import ShareButton from "@/components/ShareButton";
import SaveToTripButton, { type SaveToTripLabels } from "@/components/SaveToTripButton";

type Props = {
  /** Affiliate / check-availability URL. Tracking + rel are applied here, unchanged. */
  href: string;
  hotelName: string;
  city?: string;
  slug: string;
  locale: string;
  saveLabels: SaveToTripLabels;
  /** When omitted, the Share control is not rendered (e.g. the detail page shares from its header). */
  shareTitle?: string;
  shareUrl?: string;
  /**
   * Trust fix (2026-07-16): the hotel's own website, already validated http(s) by the caller
   * (src/lib/delisted.ts isValidWebsiteUrl) — Stay22's "roam" link matches the NEAREST OTA-bookable
   * property, which for small direct-booking hotels can land on a DIFFERENT hotel. Purely ADDITIVE
   * per founder spec (revenue call, 2026-07-16): "Check availability" stays PRIMARY, unchanged, in
   * its original position; when present, this renders BESIDE it as a secondary/outline button so
   * direct-booking hotels always have their true link visible without touching affiliate revenue.
   * When absent, the row is byte-for-byte what it was before this fix.
   */
  websiteUrl?: string | null;
  websiteLabel?: string | null;
};

export default function HotelActions({ href, hotelName, city, slug, locale, saveLabels, shareTitle, shareUrl, websiteUrl, websiteLabel }: Props) {
  const hasWebsite = !!websiteUrl && !!websiteLabel;
  return (
    <div className="mt-3 flex w-full max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <a
        href={href}
        target="_blank"
        rel="noopener nofollow sponsored"
        data-cta="check_availability"
        data-hotel={hotelName}
        data-city={city}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-white no-underline sm:w-auto"
        style={{ background: "var(--ember)" }}
      >
        Check availability
      </a>
      {hasWebsite && (
        <a
          href={websiteUrl as string}
          target="_blank"
          rel="noopener nofollow"
          data-cta="hotel_website"
          data-hotel={hotelName}
          data-city={city}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium no-underline sm:w-auto"
          style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}
        >
          {websiteLabel}
        </a>
      )}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <SaveToTripButton variant="compact" block hotelSlug={slug} locale={locale} labels={saveLabels} />
        {shareTitle ? <ShareButton variant="icon" block title={shareTitle} url={shareUrl} /> : null}
      </div>
    </div>
  );
}

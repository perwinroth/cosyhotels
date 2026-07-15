// Shared hotel action row (Check availability + Save + Share). One component so every public
// listing/guide/detail page renders the SAME wrap-safe, touch-friendly control group.
//
// Layout (founder-chosen):
//   • mobile  → full-width stacked: an ember primary "Check availability" button, and beneath it a
//               compact row holding Save + Share.
//   • >= sm   → a single inline row (wrap allowed) so it never overflows the card or the viewport.
// Every control is >= 44px tall and shares the rounded-xl radius family, so the three read as one
// system. This is a server component: it merely composes the client SaveToTripButton + ShareButton.
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
};

export default function HotelActions({ href, hotelName, city, slug, locale, saveLabels, shareTitle, shareUrl }: Props) {
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
      <div className="flex items-center gap-2">
        <SaveToTripButton variant="compact" hotelSlug={slug} locale={locale} labels={saveLabels} />
        {shareTitle ? <ShareButton variant="icon" title={shareTitle} url={shareUrl} /> : null}
      </div>
    </div>
  );
}

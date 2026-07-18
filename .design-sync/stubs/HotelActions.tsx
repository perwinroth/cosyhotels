// PREVIEW STUB — sync English rendering of src/components/HotelActions.tsx for design-sync only.
// Real resolveBookingCta + real JSX (copied verbatim from the server component, awaits resolved to
// their locale==='en' values). Update alongside HotelActions markup changes. Never ships to prod.
import ShareButton, { type ShareLabels } from "../../src/components/ShareButton";
import SaveToTripButton, { type SaveToTripLabels } from "../../src/components/SaveToTripButton";
import { resolveBookingCta } from "../../src/lib/ctaPolicy";
import { isRealHotelWebsite } from "../../src/lib/delisted";

type Props = {
  stay22Href: string; hotelName: string; city?: string; slug: string; locale: string;
  saveLabels: SaveToTripLabels; shareTitle?: string; shareUrl?: string;
  website?: string | null; isVerifiedWrong?: boolean; showWebsiteSecondary?: boolean;
};

const EN_SHARE: ShareLabels = {
  toggle: "Share", copyLink: "Copy link", copied: "Copied", email: "Email", pinIt: "Pin it",
  instagramCopied: "Link copied for Instagram", emailIntro: "Thought you might like this:",
  emailFooter: "Found on gotcosy.com",
};

export default function HotelActions({ stay22Href, hotelName, city, slug, locale, saveLabels, shareTitle, shareUrl, website, isVerifiedWrong, showWebsiteSecondary }: Props) {
  const cta = resolveBookingCta(website, stay22Href, !!isVerifiedWrong);
  const label = cta.label;
  const showSecondary = !!showWebsiteSecondary && cta.dataCta === "check_availability" && isRealHotelWebsite(website);
  const secondaryLabel = showSecondary ? "Visit hotel website" : null;
  const shareLabels = shareTitle ? EN_SHARE : null;
  return (
    <div className="mt-3 flex w-full max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <a href={cta.href} target="_blank" rel={cta.rel} data-cta={cta.dataCta} data-hotel={hotelName} data-city={city}
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium text-white no-underline sm:w-auto"
        style={{ background: "var(--ember)" }}>
        {label}
      </a>
      {showSecondary && (
        <a href={String(website).trim()} target="_blank" rel="noopener nofollow" data-cta="hotel_website" data-hotel={hotelName} data-city={city}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl px-5 text-sm font-medium no-underline sm:w-auto"
          style={{ border: "1px solid var(--line)", color: "var(--foreground)" }}>
          {secondaryLabel}
        </a>
      )}
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <SaveToTripButton variant="compact" block hotelSlug={slug} locale={locale} labels={saveLabels} />
        {shareTitle && shareLabels ? <ShareButton variant="icon" block title={shareTitle} url={shareUrl} label={shareLabels.toggle} labels={shareLabels} /> : null}
      </div>
    </div>
  );
}

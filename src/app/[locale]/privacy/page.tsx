import type { Metadata } from "next";
import { translate } from "@/lib/i18n/translate";

export const metadata: Metadata = {
  title: "Privacy Policy",
  // Self-referencing canonical to the /en twin (only /en is indexed).
  alternates: { canonical: "/en/privacy" },
};

type Props = { params: { locale: string } };

// Standing rule: every reader-facing string routes through translate() for non-en locales.
const tx = (locale: string) => (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));

export default async function PrivacyPage({ params }: Props) {
  const locale = params.locale;
  const t = tx(locale);
  const [
    heading, intro,
    hWhatWeCollect, bUsageAnalytics, bOutboundClicks, bCollections,
    hCookies, bCookies,
    hLawfulBasis, bLawfulBasis,
    hRetention, bRetention, bRetentionTokens,
    hSubProcessors, bSubProcessors,
    hThirdParties, bThirdParties,
    hYourRights, bYourRightsIntro,
    rAccess, rRectification, rErasure, rRestriction, rObjection, rWithdraw, rPortability, rComplain,
    accessErasureIntro, findLinkLabel, accessErasureSteps, unsubscribeExplainer, manualContact,
    hContact, bContact,
  ] = await Promise.all([
    t("Privacy Policy"),
    t("We respect your privacy and only collect the minimum data needed to operate and improve the site."),
    t("What we collect"),
    t("Usage analytics: anonymous page views and events (e.g. filter usage). Used to understand what's working and fix issues."),
    t("Outbound clicks: when you click a booking link, we record a basic log (time, hotel slug, referral parameters). Used for performance reporting and fraud prevention."),
    t("Collections: the email you enter to save or find a collection, whether you opted in to marketing emails, and the hotels and titles you put in your collections. Nothing else identifying is collected. We do not use this data for tracking ads."),
    t("Cookies and local storage"),
    t("We may use cookies for analytics and affiliate attribution. We also use local storage on your device to remember your saved collections (their links and edit tokens) so you can keep adding to them. You can clear these at any time in your browser."),
    t("Lawful basis"),
    t("Our lawful basis for processing is consent and legitimate interests. Collections are created, and marketing emails sent, only because you chose to: you enter your email to save or find a collection, and you separately opt in before we send you anything promotional. Where required, we also request consent for analytics cookies."),
    t("Retention"),
    t("Collections and the email tied to them are kept until you delete them or ask us to. You can delete everything yourself at any time (see Your rights below)."),
    t("Magic-link access tokens (the links we email you to find your collections) expire after 30 minutes and cannot be reused once expired."),
    t("Who processes your data"),
    t("We use a small number of specialist providers to run the site and never sell your data to anyone. Supabase hosts our database. Vercel hosts the application. Resend sends the emails you request (a magic link, or marketing email if you opted in)."),
    t("Third parties"),
    t("We also work with analytics providers and affiliate networks (e.g., Impact/Booking.com). These services may receive basic event or click information to attribute bookings and measure traffic."),
    t("Your rights"),
    t("Under GDPR you have the right to:"),
    t("Access: ask what data we hold about you."),
    t("Rectification: ask us to correct inaccurate data."),
    t("Erasure: ask us to delete your data (the right to be forgotten)."),
    t("Restriction: ask us to limit how we use your data."),
    t("Objection: object to how we process your data."),
    t("Withdraw consent: stop marketing emails, or withdraw any other consent, at any time."),
    t("Portability: receive the data you gave us in a portable format."),
    t("Complain: lodge a complaint with your national data protection supervisory authority."),
    t("To access or erase your data yourself, use"),
    t("Find your collections"),
    t("Enter your email, open the link we send you, then view or permanently delete everything from that page."),
    t("To stop marketing emails: use the unsubscribe link included in any marketing email, or delete your data as above."),
    t("For anything else, or if self-service does not cover it, email us directly:"),
    t("Contact"),
    t("Email: per@gotcosy.com"),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{heading}</h1>
      <div className="longform mt-6">
        <p>{intro}</p>

        <h2>{hWhatWeCollect}</h2>
        <ul>
          <li><strong>{bUsageAnalytics.split(":")[0]}</strong>: {bUsageAnalytics.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{bOutboundClicks.split(":")[0]}</strong>: {bOutboundClicks.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{bCollections.split(":")[0]}</strong>: {bCollections.split(":").slice(1).join(":").trim()}</li>
        </ul>

        <h2>{hCookies}</h2>
        <p>{bCookies}</p>

        <h2>{hLawfulBasis}</h2>
        <p>{bLawfulBasis}</p>

        <h2>{hRetention}</h2>
        <p>{bRetention}</p>
        <p>{bRetentionTokens}</p>

        <h2>{hSubProcessors}</h2>
        <p>{bSubProcessors}</p>

        <h2>{hThirdParties}</h2>
        <p>{bThirdParties}</p>

        <h2>{hYourRights}</h2>
        <p>{bYourRightsIntro}</p>
        <ul>
          <li><strong>{rAccess.split(":")[0]}</strong>: {rAccess.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rRectification.split(":")[0]}</strong>: {rRectification.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rErasure.split(":")[0]}</strong>: {rErasure.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rRestriction.split(":")[0]}</strong>: {rRestriction.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rObjection.split(":")[0]}</strong>: {rObjection.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rWithdraw.split(":")[0]}</strong>: {rWithdraw.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rPortability.split(":")[0]}</strong>: {rPortability.split(":").slice(1).join(":").trim()}</li>
          <li><strong>{rComplain.split(":")[0]}</strong>: {rComplain.split(":").slice(1).join(":").trim()}</li>
        </ul>
        <p>
          {accessErasureIntro}{" "}
          <a href={`/${locale}/collections/find`} className="font-medium hover:underline" style={{ color: "var(--ember)" }}>
            {findLinkLabel}
          </a>
          . {accessErasureSteps}
        </p>
        <p>{unsubscribeExplainer}</p>
        <p>
          {manualContact}{" "}
          <a href="mailto:per@gotcosy.com" className="font-medium hover:underline" style={{ color: "var(--ember)" }}>per@gotcosy.com</a>
        </p>

        <h2>{hContact}</h2>
        <p>{bContact}</p>
      </div>
    </div>
  );
}

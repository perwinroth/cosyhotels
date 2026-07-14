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
  const t = tx(params.locale);
  const [
    heading, intro,
    hWhatWeCollect, bUsageAnalytics, bOutboundClicks, bSavedLists,
    hCookies, bCookies,
    hLawfulBasis, bLawfulBasis,
    hRetention, bRetention,
    hThirdParties, bThirdParties,
    hYourRights, bYourRights,
    hContact, bContact,
  ] = await Promise.all([
    t("Privacy Policy"),
    t("We respect your privacy and only collect the minimum data needed to operate and improve the site."),
    t("What we collect"),
    t("Usage analytics: anonymous page views and events (e.g. filter usage). Used to understand what's working and fix issues."),
    t("Outbound clicks: when you click a booking link, we record a basic log (time, hotel slug, referral parameters). Used for performance reporting and fraud prevention."),
    t("Saved lists: if you save hotels to a plan, the email you enter is stored only as the identity for your private edit link. It is never shown on any page. The public plan page shows only your list title and the hotels you picked. Your private edit link is a secret token; you can ask us to revoke it at any time. By saving a plan you consent to us storing your email for this purpose."),
    t("Cookies and local storage"),
    t("We may use cookies for analytics and affiliate attribution. We also use local storage on your device to remember your saved plan (its link and edit token) so you can keep adding to it. You can clear these at any time in your browser."),
    t("Lawful basis"),
    t("Our lawful basis for processing is legitimate interests: operating the website, measuring performance, and preventing abuse. Where required, we will request consent for analytics cookies, and we always request consent before storing an email for a saved plan."),
    t("Retention"),
    t("Analytics events are retained in aggregate. Affiliate click logs are retained as required for reporting. Saved plans and the email tied to them remain stored until you ask us to remove them."),
    t("Third parties"),
    t("We work with analytics providers and affiliate networks (e.g., Impact/Booking.com). These services may receive basic event or click information to attribute bookings and measure traffic."),
    t("Your rights"),
    t("You may contact us to request removal of a saved plan or its stored email, or to ask questions about this policy."),
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
          <li><strong>{bSavedLists.split(":")[0]}</strong>: {bSavedLists.split(":").slice(1).join(":").trim()}</li>
        </ul>

        <h2>{hCookies}</h2>
        <p>{bCookies}</p>

        <h2>{hLawfulBasis}</h2>
        <p>{bLawfulBasis}</p>

        <h2>{hRetention}</h2>
        <p>{bRetention}</p>

        <h2>{hThirdParties}</h2>
        <p>{bThirdParties}</p>

        <h2>{hYourRights}</h2>
        <p>{bYourRights}</p>

        <h2>{hContact}</h2>
        <p>{bContact}</p>
      </div>
    </div>
  );
}

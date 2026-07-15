import type { Metadata } from "next";
import { translate } from "@/lib/i18n/translate";
import CollectionsFindForm from "@/components/CollectionsFindForm";

// "Find my collections" (magic link by email). Never indexed: this is a utility page, not
// editorial content, and it must never accumulate backlinks/crawl budget.
export const metadata: Metadata = {
  title: "Find your collections",
  robots: { index: false, follow: false },
};

type Props = { params: { locale: string } };

export default async function CollectionsFindPage({ params }: Props) {
  const locale = params.locale;
  const t = (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));
  const [heading, intro, emailLabel, emailPlaceholder, submit, sending, result] = await Promise.all([
    t("Find your collections"),
    t("Saved a cosy hotel collection on another device? Enter the email you used and we will send you a link to it."),
    t("Your email"),
    t("you@example.com"),
    t("Send me the link"),
    t("Sending…"),
    t("If that email has collections, we just sent a link. Check your inbox."),
  ]);

  return (
    <article className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">{heading}</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>{intro}</p>
      <CollectionsFindForm
        locale={locale}
        labels={{ heading, intro, emailLabel, emailPlaceholder, submit, sending, result }}
      />
    </article>
  );
}

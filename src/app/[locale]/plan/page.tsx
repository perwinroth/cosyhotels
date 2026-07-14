import type { Metadata } from "next";
import { TRIP_BOARDS } from "@/data/tripBoards";
import { boardTouchesControl, stopCities } from "@/lib/trips";
import { translate } from "@/lib/i18n/translate";
import TripDestinationPicker, { type PickerDestination } from "@/components/TripDestinationPicker";

type Props = { params: { locale: string } };

const tx = (locale: string) => (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));

const PAGE_TITLE = "Plan a cosy trip";
const PAGE_DEK = "A handful of curated routes through the cosiest towns we have scored, plus a quick way to jump to wherever you are already headed.";

// Control-safe board set: a board touching a control market never appears (none do today).
const BOARDS = TRIP_BOARDS.filter((b) => !boardTouchesControl(b));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = tx(params.locale);
  const title = await t(PAGE_TITLE);
  const description = await t(PAGE_DEK);
  const url = `/${params.locale}/plan`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, type: "website", url },
  };
}

export default async function PlanPage({ params }: Props) {
  const t = tx(params.locale);
  const [title, dek] = await Promise.all([t(PAGE_TITLE), t(PAGE_DEK)]);
  const [lPrompt, lPlaceholder, lGo, lMailto] = await Promise.all([
    t("Already know where you are going?"),
    t("Type a city, for example Bruges"),
    t("Go"),
    t("Somewhere we do not cover yet? Tell us and we will point you the right way."),
  ]);

  // Translate each board's title + dek (editorial copy). City names in the destination list stay
  // untranslated (they are data the picker matches typed input against).
  const cards = await Promise.all(
    BOARDS.map(async (b) => ({
      slug: b.slug,
      title: await t(b.title),
      dek: await t(b.dek),
      season: await t(b.season),
    })),
  );

  // Destination index: every stop city + its aliases -> that board, so typing any spelling routes.
  const destinations: PickerDestination[] = [];
  for (const b of BOARDS) {
    for (const stop of b.stops) {
      for (const c of stopCities(stop)) destinations.push({ label: c, boardSlug: b.slug });
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-2xl" style={{ color: "var(--muted)" }}>{dek}</p>

      <div className="mt-6 rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <TripDestinationPicker
          locale={params.locale}
          destinations={destinations}
          labels={{ prompt: lPrompt, placeholder: lPlaceholder, go: lGo, mailtoText: lMailto }}
          mailto="mailto:per@gotcosy.com"
        />
      </div>

      <ul className="mt-10 space-y-4">
        {cards.map((c) => (
          <li key={c.slug}>
            <a href={`/${params.locale}/trips/${c.slug}`} className="block rounded-xl border p-5 no-underline hover:shadow-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <span className="text-xs font-medium uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{c.season}</span>
              <h2 className="mt-1 text-lg font-semibold" style={{ color: "var(--foreground)" }}>{c.title}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{c.dek}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

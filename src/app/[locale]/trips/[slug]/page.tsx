import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTripBoard } from "@/data/tripBoards";
import { boardTouchesControl } from "@/lib/trips";
import { resolveBoardLive } from "@/lib/tripsLive";
import { translate } from "@/lib/i18n/translate";
import { cosyBadgeColor } from "@/lib/cosyColor";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

// Editorial strings route through translate() for non-en, EXACTLY like the guide page
// (params.locale === 'en' ? str : await translate(str, params.locale)). Hotel names, cities and
// scores are DATA and stay untranslated.
const tx = (locale: string) => (s: string) => (locale === "en" ? Promise.resolve(s) : translate(s, locale));

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com";

// hreflang alternates for the enabled locales (trips are genuinely translated content, unlike the
// near-duplicate city guides, so per-locale alternates are valid here).
function languageAlternates(slug: string): Record<string, string> {
  const langs: Record<string, string> = {};
  for (const l of locales) langs[l] = `/${l}/trips/${slug}`;
  langs["x-default"] = `/en/trips/${slug}`;
  return langs;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const board = getTripBoard(params.slug);
  if (!board || boardTouchesControl(board)) return { robots: { index: false, follow: false } };
  const t = tx(params.locale);
  const title = await t(board.title);
  const description = await t(board.dek);
  const url = `/${params.locale}/trips/${board.slug}`;
  // A board whose live membership can't fill every stop (any stop < 2 picks) noindexes itself.
  const { indexable } = await resolveBoardLive(board);
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(board.slug) },
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function TripBoardPage({ params }: Props) {
  const board = getTripBoard(params.slug);
  if (!board) notFound();
  // Control exclusion: a board touching a control market (York/Savannah/Fez/Venice-historic) must
  // never render. Exact-match via boardTouchesControl (New York survives).
  if (boardTouchesControl(board)) notFound();

  const t = tx(params.locale);
  const [title, dek, season, whenToGo] = await Promise.all([
    t(board.title), t(board.dek), t(board.season), t(board.whenToGo),
  ]);
  // Section labels + disclosures are reader-facing too, so they translate for non-en (standing rule).
  const [lRoute, lNights, lStay, lWhenToGo, lMethod, lNoPicks, lDisclosure] = await Promise.all([
    t("The route"), t("nights"), t("Where to stay"), t("When to go"),
    t("How we score cosiness"), t("We are still scoring cosy stays here; check back shortly."),
    t("Hotel picks are our own AI cosy scores, read live at the moment you open this page. Links to book are affiliate links; the scores are not for sale."),
  ]);

  const resolved = await resolveBoardLive(board);
  const whyOrders = await Promise.all(resolved.stops.map((s) => t(s.stop.whyOrder)));

  const detailsHref = (slug: string) => `/${params.locale}/hotels/${slug}`;

  // JSON-LD: ItemList of the stops (cities in route order), machine-readable for answer engines.
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description: dek,
    numberOfItems: resolved.stops.length,
    itemListElement: resolved.stops.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.stop.city,
      item: { "@type": "TouristDestination", name: s.stop.city, url: `${SITE}/${params.locale}/trips/${board.slug}` },
    })),
  };

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }} />
      <p className="text-xs font-medium uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{season}</p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>{dek}</p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{lRoute}</h2>
        <ol className="mt-4 space-y-8">
          {resolved.stops.map((s, idx) => (
            <li key={s.stop.city}>
              <div className="flex items-baseline gap-2">
                <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span>
                <h3 className="text-lg font-semibold">{s.stop.city}</h3>
                <span className="text-sm" style={{ color: "var(--muted)" }}>{s.stop.nights} {lNights}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{whyOrders[idx]}</p>

              <div className="mt-4">
                <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{lStay}</span>
                {s.picks.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {s.picks.map((p) => (
                      <li key={p.slug} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                        <span className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white" style={{ background: cosyBadgeColor(p.score), width: 44, height: 44, fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600 }}>
                          {p.score.toFixed(1)}
                        </span>
                        <div className="min-w-0">
                          <a href={detailsHref(p.slug)} className="font-medium hover:underline">{p.name}</a>
                          <div className="text-xs" style={{ color: "var(--muted)" }}>{[p.city, p.country].filter(Boolean).join(", ")}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{lNoPicks}</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{lWhenToGo}</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{whenToGo}</p>
      </section>

      <footer className="mt-12 border-t pt-6 text-sm" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>
        <a href={`/${params.locale}/cosy-index`} className="hover:underline">{lMethod}</a>
        <p className="mt-2">{lDisclosure}</p>
      </footer>
    </article>
  );
}

export const revalidate = 600;

// Cosy-hotels hub landing (WP3 + fixes the /cosy-hotels 404): the browse-by index linking every
// theme hub (/cosy-hotels/{facet}) and country hub (/cosy-hotels/in/{country}). Indexable, evergreen.
import type { Metadata } from "next";
import { FACETS } from "@/lib/facets";
import { loadCountryCounts, HUB_MIN } from "@/lib/countryHub";
import { breadcrumbSchema, jsonLd } from "@/lib/schema";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/cosy-hotels`;
  const title = "Cosy hotels — browse by theme and country";
  const description = "Find genuinely cosy hotels by what makes them cosy — a fireplace, a spa, boutique character, a view — or by country. Every hotel AI-scored 0–10 for warmth and character.";
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "website", url } };
}

export default async function CosyHotelsHub({ params }: { params: { locale: string } }) {
  const l = params.locale;
  const countries = (await loadCountryCounts()).filter((c) => c.live >= HUB_MIN);
  const crumbs = breadcrumbSchema([
    { name: "Home", url: `/${l}` },
    { name: "Cosy hotels", url: `/${l}/cosy-hotels` },
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(crumbs)} />
      <h1 className="font-display text-3xl font-semibold">Cosy hotels</h1>
      <p className="mt-2 max-w-2xl" style={{ color: "var(--muted)" }}>Browse genuinely cosy places to stay by what makes them cosy, or by country. Every hotel is AI-scored 0–10 for warmth, character and intimacy — not stars.</p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">By theme</h2>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {FACETS.map((f) => (
            <a key={f.slug} href={`/${l}/cosy-hotels/${f.slug}`} className="block rounded-xl border p-4 hover:underline" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <span className="font-medium">Cosy hotels {f.label}</span>
            </a>
          ))}
        </div>
      </section>

      {countries.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">By country</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{countries.length} countries, ranked by how many cosy hotels we&apos;ve scored.</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {countries.map((c) => (
              <a key={c.country.slug} href={`/${l}/cosy-hotels/in/${c.country.slug}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm hover:underline" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <span className="truncate">{c.country.name}</span>
                <span className="tabular-nums" style={{ color: "var(--muted)" }}>{c.live}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm" style={{ color: "var(--muted)" }}>Looking for a specific city? Explore our <a href={`/${l}/guides`} className="underline">cosy hotel city guides</a> or the <a href={`/${l}/cosy-index`} className="underline">Cosy Index</a>.</p>
    </div>
  );
}

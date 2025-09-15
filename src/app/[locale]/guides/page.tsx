import Link from "next/link";
import type { Metadata } from "next";
import { guides } from "@/data/guides";
import { cityGuides } from "@/data/cityGuides";
import { locales } from "@/i18n/locales";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides`]));
  return {
    alternates: { canonical: `/${params.locale}/guides`, languages },
    title: "Guides",
    description: "Practical tips and curated advice for planning cosy stays.",
  };
}


export default function GuidesIndex({ params }: { params: { locale: string } }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Guides</h1>
      <p className="mt-2 text-zinc-600">Editorial advice and planning resources.</p>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {guides.map((g) => (
          <Link key={g.slug} href={`/${params.locale}/guides/${g.slug}`} className="block rounded-xl border border-zinc-200 p-4 hover:shadow-sm">
            <h2 className="font-medium">{g.title}</h2>
            <p className="text-sm text-zinc-600 mt-1">{g.excerpt}</p>
          </Link>
        ))}
      </div>

      {/* Curated city lists grouped by region */}
      {(() => {
        const groups: Record<string, typeof cityGuides> = {
          Europe: [],
          "North America": [],
          "Asia-Pacific": [],
          Other: [],
        };
        for (const c of cityGuides) {
          (groups[c.region] ||= []).push(c);
        }
        return (
          <div className="mt-10 space-y-8">
            {Object.entries(groups).map(([region, items]) => (
              items.length ? (
                <section key={region}>
                  <h2 className="text-lg font-medium">{region}</h2>
                  <div className="mt-3 grid md:grid-cols-2 gap-4">
                    {items.map((c) => (
                      <Link key={c.slug} href={`/${params.locale}/guides/${c.slug}`} className="block rounded-xl border border-zinc-200 p-4 hover:shadow-sm">
                        <h3 className="font-medium">{c.city} cosy hotels</h3>
                        <p className="text-sm text-zinc-600 mt-1">9 handpicked cosy and romantic stays in {c.city}.</p>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null
            ))}
          </div>
        );
      })()}
    </div>
  );
}

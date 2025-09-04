import type { Metadata } from "next";
import { getGuide } from "@/data/guides";
import { locales } from "@/i18n/locales";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const g = getGuide(params.slug);
  if (!g) return {};
  const url = `/${params.locale}/guides/${g.slug}`;
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/guides/${g.slug}`]));
  return {
    title: g.title,
    description: g.excerpt,
    alternates: { canonical: url, languages },
    openGraph: { title: g.title, description: g.excerpt, type: "article", url },
    twitter: { card: "summary", title: g.title, description: g.excerpt },
  };
}

export default function GuidePage({ params }: Props) {
  const g = getGuide(params.slug);
  if (!g) return <div className="mx-auto max-w-3xl px-4 py-8">Guide not found.</div>;
  return (
    <article className="prose prose-zinc mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2">{g.title}</h1>
      <p className="text-zinc-600">{g.excerpt}</p>
      <div className="mt-6" dangerouslySetInnerHTML={{ __html: g.body }} />

      {/* JSON-LD Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: g.title,
            description: g.excerpt,
            mainEntityOfPage: { '@type': 'WebPage', '@id': `/guides/${g.slug}` },
          }),
        }}
      />
    </article>
  );
}

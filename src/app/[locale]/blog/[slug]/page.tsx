import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { getBlogPost, BLOG_POSTS, type BlogSection } from "@/data/blogPosts";
import { getServerSupabase } from "@/lib/supabase/server";
import { selectBlogHotels, type BlogPick } from "@/lib/blogPicks";
import { cosyBadgeColor } from "@/lib/cosyColor";
import ShareButton from "@/components/ShareButton";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

export const revalidate = 3600;

type Props = { params: { slug: string; locale: string } };

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  const url = `/${params.locale}/blog/${post.slug}`;
  return {
    title: post.title, description: post.dek,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.dek, type: "article", url },
    twitter: { card: "summary_large_image", title: post.title, description: post.dek },
  };
}

function Section({ s }: { s: BlogSection }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{s.h2}</h2>
      {s.paras.map((p, i) => (
        <p key={i} className="mt-3 leading-relaxed" style={{ color: "var(--foreground)" }}>{p}</p>
      ))}
      {s.tip && (
        <p className="mt-4 rounded-xl border-l-2 px-4 py-3 text-sm leading-relaxed" style={{ borderColor: "var(--ember)", background: "color-mix(in srgb, var(--ember) 7%, var(--card))", color: "var(--foreground)" }}>
          <strong style={{ color: "var(--ember)" }}>Tip&nbsp;·&nbsp;</strong>{s.tip}
        </p>
      )}
    </section>
  );
}

function PickCard({ h, idx, locale }: { h: BlogPick; idx: number; locale: string }) {
  const detailsHref = `/${locale}/hotels/${h.slug}`;
  return (
    <li className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 flex items-center justify-center rounded-2xl text-white shadow" style={{ background: cosyBadgeColor(h.score), width: 56, height: 56, fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600 }}>{h.score.toFixed(1)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm tabular-nums" style={{ color: "var(--muted)" }}>#{idx + 1}</span>
            <h3 className="text-lg font-semibold leading-tight"><a href={detailsHref} className="hover:underline">{h.name}</a></h3>
          </div>
          <div className="text-sm" style={{ color: "var(--muted)" }}>{[h.city, h.country].filter(Boolean).join(", ")}</div>
          {h.snippet && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>{h.snippet}</p>}
          <div className="mt-3 flex items-center gap-2">
            <a href={h.cta} target="_blank" rel="noopener nofollow sponsored" data-cta="check_availability" data-hotel={h.name} data-city={h.city} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>Check availability</a>
            <ShareButton variant="icon" title={`${h.name} — cosy hotel in ${h.city}`} url={detailsHref} />
          </div>
        </div>
        {h.img && (
          <a href={detailsHref} className="flex-shrink-0 hidden sm:block">
            <div className="relative rounded-lg overflow-hidden" style={{ width: 120, height: 90 }}>
              <Image src={h.img} alt={`${h.name} – ${h.city}`} fill className="object-cover" sizes="120px" quality={60} unoptimized={/^https?:\/\//.test(h.img)} />
            </div>
          </a>
        )}
      </div>
    </li>
  );
}

export default async function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();
  const L = params.locale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || site.url;

  let picks: BlogPick[] = [];
  if (post.pick) {
    const db = getServerSupabase();
    if (db) {
      try {
        picks = await selectBlogHotels(db, { ...post.pick, campaign: `blog-${post.slug}` });
      } catch { picks = []; }
    }
  }

  const articleLd = {
    "@context": "https://schema.org", "@type": "Article",
    headline: post.title, description: post.dek,
    author: { "@type": "Organization", name: "Got Cosy" },
    publisher: { "@type": "Organization", name: "Got Cosy", logo: { "@type": "ImageObject", url: `${site.url}/icon` } },
    datePublished: post.updated, dateModified: post.updated,
    mainEntityOfPage: `${siteUrl}/${L}/blog/${post.slug}`,
  };
  const faqLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: post.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const listLd = picks.length ? {
    "@context": "https://schema.org", "@type": "ItemList",
    name: post.pick?.heading || post.title, numberOfItems: picks.length,
    itemListElement: picks.map((h, i) => ({
      "@type": "ListItem", position: i + 1,
      item: {
        "@type": "Hotel", name: h.name, url: `${siteUrl}/${L}/hotels/${h.slug}`,
        ...(h.img && /^https?:\/\//.test(h.img) ? { image: h.img } : {}),
        ...(h.city || h.country ? { address: { "@type": "PostalAddress", ...(h.city ? { addressLocality: h.city } : {}), ...(h.country ? { addressCountry: h.country } : {}) } } : {}),
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: h.score, bestRating: 10, worstRating: 0, name: "Cosy score" }, ...(h.snippet ? { reviewBody: h.snippet } : {}) },
      },
    })),
  } : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      {listLd && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(listLd)} />}

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>{post.eyebrow}</p>
        <div className="flex-none"><ShareButton title={post.title} url={`/${L}/blog/${post.slug}`} /></div>
      </div>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">{post.h1}</h1>
      <p className="mt-5 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>{post.lead}</p>

      {post.intro.map((s, i) => <Section key={i} s={s} />)}

      {post.pick && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{post.pick.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{post.pick.blurb}</p>
          {picks.length > 0 ? (
            <ol className="mt-5 space-y-3">
              {picks.map((h, i) => <PickCard key={h.slug} h={h} idx={i} locale={L} />)}
            </ol>
          ) : (
            <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>We&apos;re refreshing this list — check back shortly, or browse <a href={`/${L}/cosy-index`} className="underline">the Cosy Index</a>.</p>
          )}
        </section>
      )}

      {post.outro.map((s, i) => <Section key={i} s={s} />)}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <dl className="mt-4 space-y-4">
          {post.faqs.map((f) => (
            <div key={f.q} className="border rounded-lg p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
              <dt className="font-medium" style={{ color: "var(--foreground)" }}>{f.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {post.related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Read next</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.related.map((r) => (
              <a key={r.to} href={`/${L}/${r.to}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>{r.label}</a>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs" style={{ color: "var(--muted)" }}>Got Cosy ranks hotels by cosiness using AI. Picks are drawn live from our scored dataset; bookings via partner sites may earn us a commission. Last updated {post.updated}.</p>
    </article>
  );
}

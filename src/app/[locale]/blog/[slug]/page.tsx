import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getBlogPost, type BlogSection, type BlogRelated } from "@/data/blogPosts";
import { isBlogPostVisible } from "@/lib/blogSchedule";
import blogPicksData from "@/data/blogPicks.json";

// Picks are precomputed (scripts/generate-blog-picks.mts): each hotel assigned to ONE post, with a
// bespoke grounded "why it fits this topic" line. Regenerate the JSON to refresh.
import { picksWithLiveScores, type PickEntry } from "@/lib/blogPickScores";
import { resolveBookingCta, getStay22WrongSlugs } from "@/lib/ctaPolicy";
import { getServerSupabase } from "@/lib/supabase/server";
type BlogPick = PickEntry;
const BLOG_PICKS = blogPicksData as Record<string, BlogPick[]>;
import ShareButton from "@/components/ShareButton";
import HotelCard from "@/components/HotelCard";
import { type SaveToTripLabels } from "@/components/SaveToTripButton";
import { buildSaveLabels } from "@/lib/i18n/saveLabels";
import { site } from "@/config/site";
import { jsonLd } from "@/lib/schema";

// Dynamic: the page reads the gc_panel cookie (for preview), which opts out of static caching — so a
// preview can never leak publicly, and a scheduled post goes live the instant its publish time passes.
export const dynamic = "force-dynamic";

type Props = { params: { slug: string; locale: string } };

export function generateMetadata({ params }: Props): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) return {};
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/blog/${post.slug}`;
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

function PickCard({ h, idx, locale, saveLabels, isVerifiedWrong }: { h: BlogPick; idx: number; locale: string; saveLabels: SaveToTripLabels; isVerifiedWrong: boolean }) {
  const detailsHref = `/${locale}/hotels/${h.slug}`;
  return (
    <HotelCard
      slug={h.slug}
      name={h.name}
      city={h.city}
      country={h.country}
      score={h.score}
      rank={idx + 1}
      snippet={h.why}
      snippetEyebrow="Why it's here"
      photo={h.img}
      locale={locale}
      saveLabels={saveLabels}
      stay22Href={h.cta}
      website={h.website}
      isVerifiedWrong={isVerifiedWrong}
      shareTitle={`${h.name}, a cosy hotel in ${h.city}`}
      shareUrl={detailsHref}
    />
  );
}

export default async function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();
  // Not yet released per the /growth schedule → 404 for the public. But the internal panel (the
  // gc_panel cookie set when Per unlocks /growth) can PREVIEW a scheduled/draft post to review it
  // before it publishes. Reading the cookie makes this route dynamic, so a preview can never leak
  // into a public cache — a visitor without the cookie still gets 404.
  const visible = await isBlogPostVisible(params.slug);
  const panelKey = process.env.PANEL_KEY || process.env.CRON_SECRET;
  const isPreview = !visible && !!panelKey && (await cookies()).get("gc_panel")?.value === panelKey;
  if (!visible && !isPreview) notFound();
  const L = params.locale;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || site.url;

  // Editorial picks come from the JSON; the SCORE a reader sees is always the live calculated
  // value (below-gate hotels drop out) — stored numbers went stale after the 2026-07-02 rescore.
  const storedPicks: BlogPick[] = post.pick ? (BLOG_PICKS[post.slug] || []) : [];
  const picks: BlogPick[] = await picksWithLiveScores(storedPicks);
  // Verdict-gated CTA swap (founder FINAL rule, 2026-07-16): only picks the real-browser sweep has
  // actually VERIFIED wrong get the swap; fail-safe empty set otherwise.
  const wrongSlugs = await getStay22WrongSlugs(getServerSupabase());
  // Affiliate-disclosure gate: only true when a Stay22 button actually renders below; a post whose
  // picks are all verified-wrong hotels with real websites carries no affiliate link.
  const anyStay22 = picks.some((p) => resolveBookingCta(p.website, "", wrongSlugs.has(p.slug)).mode === "stay22");
  const saveLabels = await buildSaveLabels(L);

  // A related link to a blog post that's still draft/scheduled would 404 — drop those. Non-blog
  // related links (Cosy Index, city guides, the data study) always render, so keep them as-is.
  const relatedVisible = (
    await Promise.all(
      post.related.map(async (r) =>
        r.to.startsWith("blog/") && !(await isBlogPostVisible(r.to.slice("blog/".length))) ? null : r
      )
    )
  ).filter((r): r is BlogRelated => r !== null);

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
        review: { "@type": "Review", author: { "@type": "Organization", name: "Got Cosy" }, reviewRating: { "@type": "Rating", ratingValue: h.score, bestRating: 10, worstRating: 0, name: "Cosy score" }, ...(h.why ? { reviewBody: h.why } : {}) },
      },
    })),
  } : null;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      {listLd && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(listLd)} />}

      {isPreview && (
        <div className="mb-6 rounded-lg border px-4 py-2.5 text-sm" style={{ borderColor: "var(--ember)", background: "color-mix(in srgb, var(--ember) 10%, var(--card))", color: "var(--foreground)" }}>
          <strong>Preview</strong>: not published yet. Only you (panel) can see this; the public gets a 404 until it publishes.
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>{post.eyebrow}</p>
        <div className="flex-none"><ShareButton title={post.title} url={`/${L}/blog/${post.slug}`} label="Share" /></div>
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
              {picks.map((h, i) => <PickCard key={h.slug} h={h} idx={i} locale={L} saveLabels={saveLabels} isVerifiedWrong={wrongSlugs.has(h.slug)} />)}
            </ol>
          ) : (
            <p className="mt-5 text-sm" style={{ color: "var(--muted)" }}>We&apos;re refreshing this list; check back shortly, or browse <a href={`/${L}/cosy-index`} className="underline">the Cosy Index</a>.</p>
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

      {relatedVisible.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Read next</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedVisible.map((r) => (
              <a key={r.to} href={`/${L}/${r.to}`} className="rounded-full border px-3 py-1.5 text-sm no-underline hover:underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>{r.label}</a>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-xs" style={{ color: "var(--muted)" }}>Got Cosy ranks hotels by cosiness using AI. Picks are drawn live from our scored dataset{anyStay22 ? "; bookings via partner sites may earn us a commission" : ""}. Last updated {post.updated}.</p>
    </article>
  );
}

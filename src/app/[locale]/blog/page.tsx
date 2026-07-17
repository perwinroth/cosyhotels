import type { Metadata } from "next";
import { getVisibleBlogPosts } from "@/lib/blogSchedule";
import { translate, translateMany } from "@/lib/i18n/translate";

// Hourly so a post scheduled in /growth appears within the hour of its publish_at.
export const revalidate = 3600;

const TITLE = "The Got Cosy journal: cosy hotel guides, backed by data";
const DESC = "Genuinely useful guides to cosy hotels (for solo trips, families, quiet escapes, working weeks and more), drawn from our scored dataset of 17,000+ hotels.";

export function generateMetadata(): Metadata {
  // Untranslated pages: only /en is indexed, so canonical (and og:url) point at the /en twin.
  const url = `/en/blog`;
  return { title: TITLE, description: DESC, alternates: { canonical: url }, openGraph: { title: TITLE, description: DESC, type: "website", url } };
}

export default async function BlogIndex({ params }: { params: { locale: string } }) {
  const L = params.locale;
  const posts = await getVisibleBlogPosts();
  // The blog INDEX is chrome (a list of links), in scope for translate() end to end, unlike the
  // long-form post BODIES which stay English source (founder, 2026-07-17: systematic /sv audit).
  // en short-circuits before any await; the "17,000+" figure stays as data, never translated.
  const isEn = L === "en";
  const CH = {
    eyebrow: "The journal",
    h1: "Cosy hotel guides, backed by data",
    introPre: "Genuinely useful guides to staying somewhere warm: for solo trips, families, quiet escapes and working weeks. Every list is drawn from the",
    introPost: "hotels we've scored for cosiness, not from thin air.",
  };
  let LC = CH;
  let postEyebrows = posts.map((p) => p.eyebrow);
  let postH1s = posts.map((p) => p.h1);
  let postDeks = posts.map((p) => p.dek);
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const [chromeVals, eyebrowRes, h1Res, dekRes] = await Promise.all([
      Promise.all(keys.map((k) => translate(CH[k], L))),
      translateMany(postEyebrows, L),
      translateMany(postH1s, L),
      translateMany(postDeks, L),
    ]);
    LC = Object.fromEntries(keys.map((k, i) => [k, chromeVals[i]])) as typeof CH;
    postEyebrows = eyebrowRes; postH1s = h1Res; postDeks = dekRes;
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>{LC.eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">{LC.h1}</h1>
      <p className="mt-4 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        {LC.introPre} {`17,000+`} {LC.introPost}
      </p>

      <div className="mt-10 grid gap-4">
        {posts.map((p, i) => (
          <a key={p.slug} href={`/${L}/blog/${p.slug}`} className="block rounded-2xl border p-5 no-underline transition-colors hover:border-[var(--ember)]" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{postEyebrows[i]}</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold leading-snug tracking-tight" style={{ color: "var(--foreground)" }}>{postH1s[i]}</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{postDeks[i]}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

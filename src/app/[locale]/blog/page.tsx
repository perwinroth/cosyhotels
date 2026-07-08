import type { Metadata } from "next";
import { getVisibleBlogPosts } from "@/lib/blogSchedule";

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
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.08em" }}>The journal</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight tracking-tight">Cosy hotel guides, backed by data</h1>
      <p className="mt-4 text-xl leading-relaxed" style={{ color: "var(--muted)" }}>
        Genuinely useful guides to staying somewhere warm: for solo trips, families, quiet escapes and working weeks. Every list is drawn from the {`17,000+`} hotels we&apos;ve scored for cosiness, not from thin air.
      </p>

      <div className="mt-10 grid gap-4">
        {posts.map((p) => (
          <a key={p.slug} href={`/${L}/blog/${p.slug}`} className="block rounded-2xl border p-5 no-underline transition-colors hover:border-[var(--ember)]" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>{p.eyebrow}</p>
            <h2 className="mt-1.5 font-display text-xl font-semibold leading-snug tracking-tight" style={{ color: "var(--foreground)" }}>{p.h1}</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{p.dek}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

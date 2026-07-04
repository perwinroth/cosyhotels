// Shell for every /growth/* page: a small Fraunces "Growth" wordmark, and a right-side nav rail
// (Per's explicit ask: menu on the RIGHT) with live pending-count badges. Panel-gated by middleware.
// The theme toggle + globals.css + the no-flash script come from the root layout (which DOES wrap
// this route — /growth is a plain App-Router segment), so nothing extra is needed for both themes.
import type { Metadata } from "next";
import { getServerSupabase } from "@/lib/supabase/server";
import { getBoardCounts, EXTERNAL_LINKS } from "./lib";
import GrowthNav, { type NavItem } from "./nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Growth", robots: { index: false, follow: false } };

export default async function GrowthLayout({ children }: { children: React.ReactNode }) {
  const db = getServerSupabase();
  const counts = db ? await getBoardCounts(db) : { pr: 0, badges: 0, reddit: 0, blog: 0 };

  const boards: NavItem[] = [
    { href: "/growth", label: "Today" },
    { href: "/growth/pr", label: "PR outreach", count: counts.pr },
    { href: "/growth/badges", label: "Badge outreach", count: counts.badges },
    { href: "/growth/reddit", label: "Reddit", count: counts.reddit },
    { href: "/growth/blog", label: "Blog", count: counts.blog },
    { href: "/growth/reporting", label: "Reporting" },
  ];
  const tools: NavItem[] = [
    { href: "/today", label: "Pinterest queue" },
    { href: "/outreach", label: "Instagram outreach" },
    { href: "/posts", label: "Post preview" },
    { href: "/en/cosy-index", label: "Cosy Index" },
  ];
  const analytics: NavItem[] = EXTERNAL_LINKS.map((l) => ({ href: l.href, label: l.label }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Keyboard focus + reduced-motion, scoped to the rail. Uses the ember accent per the brand. */}
      <style>{`
        .growth-navlink:focus-visible { outline: 2px solid var(--ember); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .growth-navlink { transition: none !important; } }
      `}</style>
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "22px 20px 72px" }}>
        <header style={{ marginBottom: 18, paddingRight: 44 }}>
          <span className="font-display" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--foreground)" }}>Growth</span>
          <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 10 }}>Got Cosy internal</span>
        </header>

        {/* aside is first in DOM so it stacks ABOVE content on mobile; on desktop it's placed in the
            right column and content in the left (grid col-start), so the reading order stays sane. */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_230px]">
          <aside className="md:col-start-2 md:row-start-1 md:sticky md:top-16 md:self-start">
            <GrowthNav boards={boards} tools={tools} analytics={analytics} />
          </aside>
          <main className="md:col-start-1 md:row-start-1" style={{ minWidth: 0 }}>{children}</main>
        </div>
      </div>
    </div>
  );
}

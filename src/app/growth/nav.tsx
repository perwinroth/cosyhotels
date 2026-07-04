"use client";
// The /growth nav rail. Client-only because it highlights the active route (usePathname); the
// pending counts are computed server-side in the layout and passed in as props. Desktop: a sticky
// vertical rail on the RIGHT. Mobile (<md): a horizontal, thumb-reachable scroll bar above content.
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; count?: number };

function isActive(path: string, href: string) {
  return href === "/growth" ? path === "/growth" : path.startsWith(href);
}

// Sage count pill — white text on --sage is the sanctioned pattern (see HotelTile seal pill),
// and reads in both themes.
function Count({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span
      style={{
        marginLeft: "auto",
        flex: "none",
        minWidth: 20,
        textAlign: "center",
        fontSize: 11,
        fontWeight: 700,
        color: "#fff",
        background: "var(--sage)",
        borderRadius: 999,
        padding: "1px 7px",
        lineHeight: 1.5,
      }}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}

function RailLink({ item, path, external }: { item: NavItem; path: string; external?: boolean }) {
  const active = !external && isActive(path, item.href);
  const base = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 11px",
    borderRadius: 12,
    fontSize: 13.5,
    fontWeight: active ? 600 : 500,
    textDecoration: "none",
    whiteSpace: "nowrap" as const,
    border: "1px solid",
    borderColor: active ? "var(--line)" : "transparent",
    background: active ? "var(--card)" : "transparent",
    color: active ? "var(--foreground)" : "var(--muted)",
    boxShadow: active ? "var(--shadow)" : "none",
  };
  if (external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className="growth-navlink hov" style={base}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
        <span style={{ marginLeft: "auto", flex: "none", color: "var(--muted)", fontSize: 12 }}>↗</span>
      </a>
    );
  }
  return (
    <Link href={item.href} className="growth-navlink hov" style={base} aria-current={active ? "page" : undefined}>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
      {typeof item.count === "number" ? <Count n={item.count} /> : null}
    </Link>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "var(--muted)", opacity: 0.75, padding: "0 11px", margin: "14px 0 4px" }}>
      {children}
    </div>
  );
}

export default function GrowthNav({ boards, tools, analytics }: { boards: NavItem[]; tools: NavItem[]; analytics: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Growth navigation" className="growth-nav flex gap-1.5 overflow-x-auto md:flex-col md:overflow-visible">
      {boards.map((item) => <RailLink key={item.href} item={item} path={path} />)}
      {/* Tools + external analytics: hidden on the mobile scroll bar (kept quiet), shown on desktop. */}
      <div className="hidden md:block">
        <GroupLabel>Tools</GroupLabel>
        {tools.map((item) => <RailLink key={item.href} item={item} path={path} />)}
        <GroupLabel>Analytics</GroupLabel>
        {analytics.map((item) => <RailLink key={item.href} item={item} path={path} external />)}
      </div>
    </nav>
  );
}

// WP2 — the internal-linking graph on hotel pages. Server component, no client JS: renders the
// visible breadcrumb, "more cosy hotels in {city}", relevant collections, and country/index links,
// so every hotel page is connected (city ↑, same-city ↔, collections ↔) and crawlable.
import { cosyBadgeColor } from "@/lib/cosyColor";

export type MiniHotel = { slug: string; name: string; score: number };
export type LinkItem = { href: string; label: string };

export function Breadcrumb({ items }: { items: LinkItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mt-1 mb-3 text-sm" style={{ color: "var(--muted)" }}>
      {items.map((it, i) => (
        <span key={it.href}>
          {i > 0 && <span className="mx-1.5" aria-hidden>›</span>}
          {i < items.length - 1
            ? <a href={it.href} className="hover:underline" style={{ color: "var(--muted)" }}>{it.label}</a>
            : <span style={{ color: "var(--foreground)" }}>{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}

export function HotelGraph({ city, cityGuideHref, cityLabel, sameCity, collections, extra }: {
  city: string;
  cityGuideHref: string;
  cityLabel: string;
  sameCity: MiniHotel[];
  collections: LinkItem[];
  extra: LinkItem[];
}) {
  if (!sameCity.length && !collections.length) {
    return (
      <section className="mt-12">
        <div className="flex flex-wrap gap-2">
          {extra.map((l) => <a key={l.href} href={l.href} className="rounded-full border px-3 py-1.5 text-sm no-underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>{l.label}</a>)}
        </div>
      </section>
    );
  }
  return (
    <section className="mt-12">
      {sameCity.length > 0 && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">More cosy hotels in {city}</h2>
            <a href={cityGuideHref} className="text-sm no-underline hover:underline" style={{ color: "var(--ember)" }}>See the {cityLabel} guide →</a>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {sameCity.map((h) => (
              <li key={h.slug} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <span className="flex-none flex items-center justify-center rounded-lg font-display font-bold text-white" style={{ width: 40, height: 40, background: cosyBadgeColor(h.score), fontSize: 15 }}>{h.score.toFixed(1)}</span>
                <a href={`/en/hotels/${h.slug}`} className="text-sm font-medium no-underline hover:underline" style={{ color: "var(--foreground)" }}>{h.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      {collections.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Explore cosy hotels {city && `in ${city} `}by style</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {collections.map((l) => <a key={l.href} href={l.href} className="rounded-full border px-3 py-1.5 text-sm no-underline" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>{l.label}</a>)}
          </div>
        </div>
      )}
      {extra.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {extra.map((l) => <a key={l.href} href={l.href} className="rounded-full border px-3 py-1.5 text-sm no-underline" style={{ borderColor: "var(--line)", color: "var(--muted)" }}>{l.label}</a>)}
        </div>
      )}
    </section>
  );
}

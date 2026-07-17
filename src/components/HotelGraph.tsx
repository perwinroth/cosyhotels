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

// `labels` carries pre-translated (or English-default) chrome text; callers on non-en locales build
// it via translate() (standing rule: client/shared components receive translated props, never raw
// English). Falls back to the English source when omitted so existing callers are unaffected.
export type HotelGraphLabels = {
  moreCosyHotelsIn: string; // assembled "More cosy hotels in {city}"
  seeCityGuide: string; // assembled "See the {city} guide"
  exploreByStyle: string; // assembled "Explore cosy hotels [in {city} ]by style"
};

export function HotelGraph({ city, cityGuideHref, locale = "en", sameCity, collections, extra, labels }: {
  city: string;
  cityGuideHref: string;
  cityLabel?: string;
  locale?: string;
  sameCity: MiniHotel[];
  collections: LinkItem[];
  extra: LinkItem[];
  labels?: HotelGraphLabels;
}) {
  const L: HotelGraphLabels = labels ?? {
    moreCosyHotelsIn: `More cosy hotels in ${city}`,
    seeCityGuide: `See the ${city} guide`,
    exploreByStyle: `Explore cosy hotels ${city ? `in ${city} ` : ""}by style`,
  };
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
            <h2 className="font-display text-2xl font-semibold">{L.moreCosyHotelsIn}</h2>
            <a href={cityGuideHref} className="text-sm no-underline hover:underline" style={{ color: "var(--ember)" }}>{L.seeCityGuide} →</a>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {sameCity.map((h) => (
              <li key={h.slug} className="rounded-xl border p-3 flex items-center gap-3" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
                <span className="flex-none flex items-center justify-center rounded-lg font-display font-bold text-white" style={{ width: 40, height: 40, background: cosyBadgeColor(h.score), fontSize: 15 }}>{h.score.toFixed(1)}</span>
                <a href={`/${locale}/hotels/${h.slug}`} className="text-sm font-medium no-underline hover:underline" style={{ color: "var(--foreground)" }}>{h.name}</a>
              </li>
            ))}
          </ul>
        </>
      )}
      {collections.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>{L.exploreByStyle}</h3>
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

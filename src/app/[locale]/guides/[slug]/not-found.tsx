// Rendered (HTTP 404) when a guide segment calls notFound() — i.e. a city with 0 live cosy hotels.
// The 404 status is deliberate (keeps the junk-URL space finite; see the page's render gate), but
// the page itself is warm and useful. App Router renders this within the [locale] layout and does
// NOT pass params, so the copy stays generic and links to the /en (indexed) surfaces.
import Link from "next/link";

export default function GuideNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
        <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>No cosy matches here yet.</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          We haven&apos;t found a hotel with real cosy credentials in this spot. Have one that belongs?
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/en/for-hotels" className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>
            Add it for rating
          </Link>
          <Link href="/en/cosy-hotels" className="text-sm no-underline hover:underline" style={{ color: "var(--muted)" }}>
            Browse cosy hotels
          </Link>
        </div>
      </div>
    </div>
  );
}

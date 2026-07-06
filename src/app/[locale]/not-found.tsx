import NotFoundView from "@/components/NotFoundView";

// Locale-scoped 404 — rendered WITH the site header (inside the [locale] layout) when a valid-locale
// page calls notFound() (e.g. a mistyped /en/hotels/… slug). More specific segment 404s (the guide
// not-found) still win where they exist. not-found.tsx receives no params, so — like the guide 404 —
// links point at the canonical /en surfaces.
export default function LocaleNotFound() {
  return <NotFoundView locale="en" />;
}

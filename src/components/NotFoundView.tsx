// Shared friendly 404 body, used by BOTH the root not-found (invalid-locale / top-level 404s, no site
// header) and the [locale] not-found (valid-locale missing page, rendered with the header). SERVER
// component — matches the guide 404, the pattern proven to render on-demand on prod; the only client
// bit is the isolated, Suspense-wrapped "Go back" island. Styling reuses existing tokens (no new ones).
import { Suspense } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";

export default function NotFoundView({ locale = "en" }: { locale?: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}>
        <p className="text-xs font-semibold uppercase" style={{ color: "var(--ember)", letterSpacing: "0.07em" }}>404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold" style={{ color: "var(--foreground)" }}>This page wandered off.</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          We couldn&apos;t find what you were looking for; it may have moved, or never existed. Let&apos;s get you somewhere cosy.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Suspense fallback={null}><BackButton /></Suspense>
            <Link href={`/${locale}`} className="inline-flex items-center justify-center rounded-lg text-white px-4 py-2 text-sm font-medium no-underline" style={{ background: "var(--ember)" }}>
              Back to home
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            <Link href={`/${locale}/cosy-hotels`} className="no-underline hover:underline" style={{ color: "var(--muted)" }}>Browse cosy hotels</Link>
            <Link href={`/${locale}/guides`} className="no-underline hover:underline" style={{ color: "var(--muted)" }}>City guides</Link>
            <Link href={`/${locale}/search`} className="no-underline hover:underline" style={{ color: "var(--muted)" }}>Search</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

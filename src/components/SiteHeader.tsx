import Link from "next/link";
import HeaderSearch from "@/components/HeaderSearch";
import ThemeToggle from "@/components/ThemeToggle";

// Shared site header (logo + search). Used by BOTH the [locale] layout (inner pages) AND the
// homepage route (src/app/page.tsx), which is served by the root page and so does NOT get the
// [locale] layout — without this, gotcosy.com / and /en rendered with no <header> landmark.
export default function SiteHeader({ locale }: { locale: string }) {
  return (
    <header className="sticky top-0 z-30 border-b" style={{ borderColor: 'var(--line)', background: 'var(--header-bg)', backdropFilter: 'blur(12px)' }}>
      <div className="mx-auto max-w-6xl px-4 h-[68px] flex items-center justify-between gap-3">
        <Link href={`/${locale}`} className="flex items-center gap-2.5 no-underline shrink-0">
          <span aria-hidden className="flex items-center justify-center rounded-[11px]" style={{ width: 36, height: 36, background: 'linear-gradient(135deg, var(--ember), var(--gold))' }}>
            {/* Brand mark: the inverted flame that reads as a 'c' — same as the favicon. */}
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path transform="scale(-1,1) translate(-24,0)" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="#16201C" />
            </svg>
          </span>
          <span className="font-display text-xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Got Cosy?</span>
        </Link>
        {/* Search + theme toggle grouped on the right, IN-FLOW — the toggle used to be a separate
            position:fixed element in the root layout, which overlapped this Search button on any
            viewport narrower than the container. In the flex row it can never overlap again. */}
        <div className="flex items-center gap-2 min-w-0">
          <HeaderSearch locale={locale} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

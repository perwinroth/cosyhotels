"use client";
// Lets the OWNER of a saved plan see their remove controls when visiting the plain public URL
// (no ?token= in the address, e.g. after following the "Share plan" link back to themselves, or
// just returning to gotcosy.com/en/trips/lists/<slug> from history/bookmarks). On mount, if this
// device knows an edit token for THIS list's slug (checked across the whole multi-collection store,
// not just the most recently saved one — src/lib/collectionStore.ts, which also covers the legacy
// single-collection "gc_trip" key) and the current URL has no ?token=, replace the URL with the
// owner's own edit token added. The server page is force-dynamic and already verifies the token
// server-side before rendering any remove control, so this never grants access the visitor didn't
// already possess on this device; it only saves them from having to keep the emailed/copied link
// around.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/collectionStore";

export default function PlanOwnerControls({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    // Read the URL directly (rather than useSearchParams/usePathname) so this component needs no
    // Suspense boundary and never affects the page's rendering strategy.
    const url = new URL(window.location.href);
    if (url.searchParams.get("token")) return; // already token-bearing, nothing to do
    const token = getToken(slug);
    if (!token) return;
    router.replace(`${url.pathname}?token=${encodeURIComponent(token)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}

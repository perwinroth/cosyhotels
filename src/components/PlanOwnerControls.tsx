"use client";
// Lets the OWNER of a saved plan see their remove controls when visiting the plain public URL
// (no ?token= in the address, e.g. after following the "Share plan" link back to themselves, or
// just returning to gotcosy.com/en/trips/lists/<slug> from history/bookmarks). On mount, if this
// device's stored plan (localStorage "gc_trip", written by SaveToTripButton) matches THIS list's
// slug and the current URL has no ?token=, replace the URL with the owner's own edit token added.
// The server page is force-dynamic and already verifies the token server-side before rendering any
// remove control, so this never grants access the visitor didn't already possess on this device;
// it only saves them from having to keep the emailed/copied link around.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "gc_trip";

type StoredTrip = { slug: string; editToken: string };

function readStoredTrip(): StoredTrip | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.slug === "string" && typeof parsed.editToken === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

export default function PlanOwnerControls({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    // Read the URL directly (rather than useSearchParams/usePathname) so this component needs no
    // Suspense boundary and never affects the page's rendering strategy.
    const url = new URL(window.location.href);
    if (url.searchParams.get("token")) return; // already token-bearing, nothing to do
    const trip = readStoredTrip();
    if (!trip || trip.slug !== slug) return;
    router.replace(`${url.pathname}?token=${encodeURIComponent(trip.editToken)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return null;
}

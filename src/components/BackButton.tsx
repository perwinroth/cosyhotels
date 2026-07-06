"use client";
// Minimal client island: the only interactive bit of the 404. Isolated (and Suspense-wrapped by the
// caller) so the not-found itself stays a SERVER component — the pattern proven to render on-demand
// on prod (the guide 404). A page-level client not-found risks a hard on-demand render failure.
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()} className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--line)", color: "var(--foreground)" }}>
      ← Go back
    </button>
  );
}

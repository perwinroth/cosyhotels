"use client";
// Tiny edit affordance on a saved list's public page. Rendered ONLY by the server page when the
// visitor's ?token= query param already matched the row's edit_token server-side (so this
// component never has to know a secret it wasn't already handed by the URL it was loaded from).
import { useState } from "react";

type Props = { slug: string; token: string; hotelSlug: string; label: string; removingLabel: string };

export default function TripListRemoveControl({ slug, token, hotelSlug, label, removingLabel }: Props) {
  const [busy, setBusy] = useState(false);

  async function onRemove() {
    setBusy(true);
    try {
      const res = await fetch(`/api/shortlists/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: hotelSlug, token }),
      });
      if (res.ok) window.location.reload();
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={busy}
      className="ml-auto flex-none rounded-lg border px-2.5 py-1 text-xs"
      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
    >
      {busy ? removingLabel : label}
    </button>
  );
}

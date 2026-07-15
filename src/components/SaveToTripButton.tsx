"use client";
// Save-a-place-to-your-plan (saved lists v1). No login, ever: the first save asks for an email
// (the private-link identity) and stores {slug, editToken} in localStorage under "gc_trip" so every
// later save on this device just adds to the same plan. All copy is pre-translated server-side and
// passed in via `labels` — this component renders no hardcoded English. Only ever talks to our own
// /api/shortlists routes; no mailto, no external network calls.
import { useEffect, useRef, useState } from "react";
import { addCollection, readCollections } from "@/lib/collectionStore";

export type SaveToTripLabels = {
  save: string;
  saveShort: string;
  added: string;
  emailPrompt: string;
  emailLabel: string;
  emailPlaceholder: string;
  consent: string;
  titleLabel: string;
  titlePlaceholder: string;
  submit: string;
  cancel: string;
  copyLink: string;
  copied: string;
  viewPlan: string;
  yourPrivateLink: string;
  emailInvalid: string;
  genericError: string;
  marketingConsent: string;
  findByEmail: string;
};

type Props = { hotelSlug: string; locale: string; labels: SaveToTripLabels; variant?: "block" | "compact" };
type StoredTrip = { slug: string; editToken: string };
type Status = "idle" | "panel" | "done" | "error";

const STORAGE_KEY = "gc_trip";

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

function writeStoredTrip(trip: StoredTrip) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
  } catch {
    /* localStorage unavailable (private mode) — the save still succeeded server-side */
  }
}

function isLikelyEmail(s: string): boolean {
  const at = s.indexOf("@");
  return at > 0 && at < s.length - 1 && s.slice(at + 1).includes(".");
}

export default function SaveToTripButton({ hotelSlug, locale, labels, variant = "block" }: Props) {
  const compact = variant === "compact";
  const [status, setStatus] = useState<Status>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listSlug, setListSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Compact variant only: the post-save confirmation is a small popover (not a layout-shifting
  // block, since this button sits inline in a card row) that auto-dismisses after a few seconds.
  const [donePopoverOpen, setDonePopoverOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === "panel") firstFieldRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (status !== "panel") return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setStatus("idle"); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [status]);

  useEffect(() => {
    if (!compact || status !== "done") return;
    setDonePopoverOpen(true);
    const id = setTimeout(() => setDonePopoverOpen(false), 4500);
    return () => clearTimeout(id);
  }, [compact, status]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const planUrl = listSlug ? `${origin}/${locale}/trips/lists/${listSlug}` : "";

  async function addToExisting(trip: StoredTrip) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/shortlists/${trip.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: hotelSlug, token: trip.editToken }),
      });
      if (!res.ok) throw new Error(labels.genericError);
      const known = readCollections().find((c) => c.slug === trip.slug);
      addCollection({ slug: trip.slug, editToken: trip.editToken, title: known?.title ?? null });
      setListSlug(trip.slug);
      setStatus("done");
    } catch {
      setError(labels.genericError);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  function onSaveClick() {
    const existing = readStoredTrip();
    if (existing) {
      void addToExisting(existing);
      return;
    }
    setStatus("panel");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!isLikelyEmail(trimmedEmail)) {
      setEmailError(labels.emailInvalid);
      return;
    }
    if (!consent) {
      setEmailError(labels.emailInvalid);
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    setError(null);
    try {
      const trimmedTitle = title.trim() || undefined;
      const res = await fetch("/api/shortlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, itemSlug: hotelSlug, title: trimmedTitle, locale, marketing }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.slug || !data.editToken) throw new Error(data.error || labels.genericError);
      writeStoredTrip({ slug: data.slug, editToken: data.editToken });
      addCollection({ slug: data.slug, editToken: data.editToken, title: trimmedTitle ?? null });
      setListSlug(data.slug);
      setStatus("done");
    } catch {
      setError(labels.genericError);
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(planUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the link is still shown as text */
    }
  }

  // Block variant: an unsaved-to-saved transition fully replaces the button with a confirmation
  // card (unchanged from v1 — no layout-shift concern, this sits in its own block below the CTA).
  if (status === "done" && !compact) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="font-medium" style={{ color: "var(--foreground)" }}>{labels.added}</p>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{labels.yourPrivateLink}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <a href={`/${locale}/trips/lists/${listSlug}`} className="text-sm font-medium hover:underline" style={{ color: "var(--ember)" }}>{labels.viewPlan}</a>
          <button type="button" onClick={onCopy} className="rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: "var(--line)" }}>
            {copied ? labels.copied : labels.copyLink}
          </button>
        </div>
        <a href={`/${locale}/collections/find`} className="mt-2 block text-xs hover:underline" style={{ color: "var(--muted)" }}>{labels.findByEmail}</a>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      {compact ? (
        <button
          type="button"
          onClick={status === "done" ? () => setDonePopoverOpen((v) => !v) : onSaveClick}
          disabled={submitting}
          aria-label={status === "done" ? labels.added : labels.saveShort}
          title={status === "done" ? labels.added : labels.saveShort}
          className="hov"
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 44, padding: "0 14px",
            borderRadius: 12, border: "1px solid var(--line)", background: "var(--card)",
            color: status === "done" ? "var(--sage)" : "var(--foreground)", fontSize: 13, fontWeight: 600,
            cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden>{status === "done" ? ICON.check : ICON.plus}</span>
          {status === "done" ? labels.added : labels.saveShort}
        </button>
      ) : (
        <button
          type="button"
          onClick={onSaveClick}
          disabled={submitting}
          className="rounded-xl px-4 py-2.5 text-sm font-medium"
          style={{ border: "1px solid var(--line)", color: "var(--foreground)", background: "var(--card)" }}
        >
          {labels.save}
        </button>
      )}

      {status === "error" && <p className="mt-1 text-xs" style={{ color: "var(--ember)" }}>{error}</p>}

      {compact && status === "done" && donePopoverOpen && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto w-auto max-w-sm rounded-xl border p-3 text-sm sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mx-0 sm:mt-2 sm:w-64"
          style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}
        >
          <p className="font-medium" style={{ color: "var(--foreground)" }}>{labels.added}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a href={`/${locale}/trips/lists/${listSlug}`} className="text-sm font-medium hover:underline" style={{ color: "var(--ember)" }}>{labels.viewPlan}</a>
            <button type="button" onClick={onCopy} className="rounded-lg border px-2.5 py-1 text-xs" style={{ borderColor: "var(--line)" }}>
              {copied ? labels.copied : labels.copyLink}
            </button>
          </div>
          <a href={`/${locale}/collections/find`} className="mt-2 block text-xs hover:underline" style={{ color: "var(--muted)" }}>{labels.findByEmail}</a>
        </div>
      )}

      {status === "panel" && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-to-trip-heading"
          className={`z-50 max-w-[90vw] rounded-2xl border p-4 ${compact ? "fixed inset-x-3 bottom-3 mx-auto w-auto max-w-sm sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:mx-0 sm:mt-2 sm:w-72" : "absolute left-0 mt-2 w-80"}`}
          style={{ borderColor: "var(--line)", background: "var(--card)", boxShadow: "var(--shadow)" }}
        >
          <h3 id="save-to-trip-heading" className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{labels.emailPrompt}</h3>
          <form onSubmit={onSubmit} className="mt-3 space-y-3">
            <div>
              <label htmlFor="gc-trip-email" className="text-xs font-medium" style={{ color: "var(--muted)" }}>{labels.emailLabel}</label>
              <input
                ref={firstFieldRef}
                id="gc-trip-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={labels.emailPlaceholder}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)", background: "var(--background)", color: "var(--foreground)" }}
                required
              />
            </div>
            <div>
              <label htmlFor="gc-trip-title" className="text-xs font-medium" style={{ color: "var(--muted)" }}>{labels.titleLabel}</label>
              <input
                id="gc-trip-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                placeholder={labels.titlePlaceholder}
                maxLength={80}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                style={{ borderColor: "var(--line)", background: "var(--background)", color: "var(--foreground)" }}
              />
            </div>
            <label className="flex items-start gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" required />
              <span>{labels.consent}</span>
            </label>
            <label className="flex items-start gap-2 text-xs" style={{ color: "var(--muted)" }}>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5" />
              <span>{labels.marketingConsent}</span>
            </label>
            {emailError && <p className="text-xs" style={{ color: "var(--ember)" }}>{emailError}</p>}
            {error && <p className="text-xs" style={{ color: "var(--ember)" }}>{error}</p>}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg px-4 py-2 text-sm font-medium"
                style={{ background: "var(--ember)", color: "#16201C" }}
              >
                {labels.submit}
              </button>
              <button type="button" onClick={() => setStatus("idle")} className="rounded-lg px-3 py-2 text-sm" style={{ color: "var(--muted)" }}>
                {labels.cancel}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const ICON = {
  plus: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>),
  check: (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>),
};

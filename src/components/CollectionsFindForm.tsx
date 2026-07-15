"use client";
// The email form on /collections/find. Always shows the SAME message after submit, whatever the
// server actually did (the API route itself is byte-identical too, so there is no oracle even at
// the network level, but the UI reinforces it: submit -> always "check your inbox", never a
// per-branch success/error state).
import { useState } from "react";

export type CollectionsFindLabels = {
  heading: string;
  intro: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  sending: string;
  result: string;
};

function isLikelyEmail(s: string): boolean {
  const at = s.indexOf("@");
  return at > 0 && at < s.length - 1 && s.slice(at + 1).includes(".");
}

export default function CollectionsFindForm({ locale, labels }: { locale: string; labels: CollectionsFindLabels }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLikelyEmail(email.trim())) return;
    setSubmitting(true);
    try {
      await fetch("/api/collections/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });
    } catch {
      /* the outcome is always the same generic message, so a network error changes nothing shown */
    } finally {
      setSubmitting(false);
      setDone(true);
    }
  }

  if (done) {
    return <p className="mt-4 text-sm" style={{ color: "var(--foreground)" }}>{labels.result}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 max-w-sm space-y-3">
      <div>
        <label htmlFor="gc-find-email" className="text-xs font-medium" style={{ color: "var(--muted)" }}>{labels.emailLabel}</label>
        <input
          id="gc-find-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.emailPlaceholder}
          required
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--background)", color: "var(--foreground)" }}
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg px-4 py-2 text-sm font-medium"
        style={{ background: "var(--ember)", color: "#16201C" }}
      >
        {submitting ? labels.sending : labels.submit}
      </button>
    </form>
  );
}

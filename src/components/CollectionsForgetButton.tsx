"use client";
// Self-service erasure (GDPR right to be forgotten) on the "your collections" page. No browser
// confirm()/alert() dialogs (environment rule): a second explicit click is the confirmation step.
// The raw magic-link access token is passed in as a prop (the visitor already holds it in their own
// URL) and posted straight to /api/collections/forget, which re-derives the email server-side.
import { useState } from "react";
import { clearCollections } from "@/lib/collectionStore";

export type ForgetLabels = {
  heading: string;
  explanation: string;
  button: string;
  confirmPrompt: string;
  confirmButton: string;
  cancelButton: string;
  deleting: string;
  done: string;
  error: string;
};

type Status = "idle" | "confirming" | "deleting" | "done" | "error";

export default function CollectionsForgetButton({ token, labels }: { token: string; labels: ForgetLabels }) {
  const [status, setStatus] = useState<Status>("idle");

  async function onConfirm() {
    setStatus("deleting");
    try {
      const res = await fetch("/api/collections/forget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data?.ok) {
        clearCollections();
        setStatus("done");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <section className="mt-10 rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
        <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>{labels.done}</p>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{labels.heading}</h2>
      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{labels.explanation}</p>

      {status === "error" && (
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{labels.error}</p>
      )}

      {status === "confirming" || status === "deleting" ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{labels.confirmPrompt}</p>
          <button
            type="button"
            onClick={onConfirm}
            disabled={status === "deleting"}
            className="rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: "#B3261E", color: "#FFFFFF" }}
          >
            {status === "deleting" ? labels.deleting : labels.confirmButton}
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            disabled={status === "deleting"}
            className="text-xs font-medium hover:underline"
            style={{ color: "var(--muted)" }}
          >
            {labels.cancelButton}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setStatus("confirming")}
          className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-medium"
          style={{ borderColor: "var(--line)", color: "var(--foreground)" }}
        >
          {labels.button}
        </button>
      )}
    </section>
  );
}

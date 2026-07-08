import type { Metadata } from "next";

export function generateMetadata(): Metadata {
  return {
    // Untranslated pages: only /en is indexed, so canonical points at the /en twin (no hreflang).
    alternates: { canonical: `/en/contact` },
    title: "Contact",
    description: "How to reach Cosy Hotel Room for questions and feedback.",
  };
}

export default function ContactPage() {
  const email = "per@gotcosy.com";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Contact</h1>
      <div className="longform mt-6">
        <p>
          We’d love to hear from you: suggestions for new cosy stays, corrections, or partnership enquiries.
        </p>
        <p>
          Email us at <a href={`mailto:${email}`}>{email}</a> and we’ll get back to you.
        </p>
      </div>
    </div>
  );
}


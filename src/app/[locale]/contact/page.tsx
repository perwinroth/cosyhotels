import type { Metadata } from "next";
import { locales } from "@/i18n/locales";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/contact`]));
  return {
    alternates: { canonical: `/${params.locale}/contact`, languages },
    title: "Contact",
    description: "How to reach Cosy Hotel Room for questions and feedback.",
  };
}

export default function ContactPage() {
  const email = "support@cosyhotelroom.com";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Contact</h1>
      <div className="prose prose-zinc mt-6">
        <p>
          We’d love to hear from you — suggestions for new cosy stays, corrections, or partnership enquiries.
        </p>
        <p>
          Email us at <a href={`mailto:${email}`}>{email}</a> and we’ll get back to you.
        </p>
      </div>
    </div>
  );
}


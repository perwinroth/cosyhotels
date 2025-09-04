import type { Metadata } from "next";
import { locales } from "@/i18n/locales";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const languages = Object.fromEntries(locales.map((l) => [l, `/${l}/about`]));
  return {
    alternates: { canonical: `/${params.locale}/about`, languages },
    title: "About",
    description: "What Cosy Hotel Room stands for and how we curate.",
  };
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">About</h1>
      <div className="prose prose-zinc mt-6">
        <p>
          Cosy Hotel Room helps travellers find warm, characterful boutique stays. We highlight places that feel intimate and welcoming — not just highly rated.
        </p>
        <p>
          Our <strong>Cosy score</strong> blends objective quality (rating) with signals linked to warmth
          (amenities, descriptive language) and a small penalty for very large hotels. It’s deliberately simple and transparent so you can understand why a place ranks well.
        </p>
        <p>
          We earn from affiliate partnerships (e.g., Booking.com via Impact) at no extra cost to you. This supports our curation and keeps the product free. See our Affiliate Disclosure for details.
        </p>
      </div>
    </div>
  );
}


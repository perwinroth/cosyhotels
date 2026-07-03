import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";

export function generateMetadata(): Metadata {
  return {
    // Untranslated pages: only /en is indexed, so canonical points at the /en twin (no hreflang).
    alternates: { canonical: `/en/about` },
    title: "About",
    description: `What ${site.name.replace(/\?$/, "")} stands for and how we score cosiness.`,
  };
}

export default function AboutPage({ params }: { params: { locale: string } }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">About</h1>
      <div className="longform mt-6">
        <p>
          {site.name.replace(/\?$/, "")} helps travellers find warm, characterful boutique stays. We highlight places that feel intimate and welcoming — not just highly rated.
        </p>
        <p>
          Our <strong>Cosy score</strong> is AI-generated from a hotel&apos;s photos, guest reviews, scale and setting — rating warmth, intimacy, character and service on a single 0–10 scale, calibrated against hundreds of hand-graded hotels. It measures how a place <em>feels</em>, not its star rating.
        </p>
        <p>
          We earn from affiliate partnerships — when you book through our links (via Stay22) we may earn a commission, at no extra cost to you. This keeps the product free. See our <Link href={`/${params.locale}/disclosure`}>Affiliate Disclosure</Link> for details.
        </p>
      </div>
    </div>
  );
}


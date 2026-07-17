import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/config/site";
import { translate } from "@/lib/i18n/translate";

export function generateMetadata(): Metadata {
  return {
    // Untranslated pages: only /en is indexed, so canonical points at the /en twin (no hreflang).
    alternates: { canonical: `/en/about` },
    title: "About",
    description: `What ${site.name.replace(/\?$/, "")} stands for and how we score cosiness.`,
  };
}

export default async function AboutPage({ params }: { params: { locale: string } }) {
  // Reader-facing body routes through translate() for non-en locales; en short-circuits before any
  // await (founder, 2026-07-17: /sv/about rendered wholly in English). Brand name (site.name) and
  // the Affiliate Disclosure link target stay as-is; text around inline <strong>/<em>/<Link> markup
  // is translated as separate fragments so the markup structure is preserved.
  const isEn = params.locale === "en";
  const CH = {
    h1: "About",
    p1Suffix: "helps travellers find warm, characterful boutique stays. We highlight places that feel intimate and welcoming, not just highly rated.",
    p2Pre: "Our",
    cosyScoreTerm: "Cosy score",
    p2Mid: "is AI-generated from a hotel's photos, guest reviews, scale and setting, rating warmth, intimacy, character and service on a single 0-10 scale, calibrated against hundreds of hand-graded hotels. It measures how a place",
    feelsTerm: "feels",
    p2Tail: ", not its star rating.",
    p3Pre: "We earn from affiliate partnerships: when you book through our links (via Stay22) we may earn a commission, at no extra cost to you. This keeps the product free. See our",
    disclosureLink: "Affiliate Disclosure",
    p3Tail: "for details.",
  };
  let LC = CH;
  if (!isEn) {
    const keys = Object.keys(CH) as (keyof typeof CH)[];
    const vals = await Promise.all(keys.map((k) => translate(CH[k], params.locale)));
    LC = Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as typeof CH;
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{LC.h1}</h1>
      <div className="longform mt-6">
        <p>
          {site.name.replace(/\?$/, "")} {LC.p1Suffix}
        </p>
        <p>
          {LC.p2Pre} <strong>{LC.cosyScoreTerm}</strong> {LC.p2Mid} <em>{LC.feelsTerm}</em>{LC.p2Tail}
        </p>
        <p>
          {LC.p3Pre} <Link href={`/${params.locale}/disclosure`}>{LC.disclosureLink}</Link> {LC.p3Tail}
        </p>
      </div>
    </div>
  );
}


import type { Metadata } from "next";
import Link from "next/link";

export function generateMetadata(): Metadata {
  const url = `/en/press`;
  // No manual "| Got Cosy?" suffix: the [locale] layout's title.template already appends it.
  const title = `Press kit`;
  const description = "Boilerplate, facts, logos and contact for writing about Got Cosy.";
  return { title, description, alternates: { canonical: url }, openGraph: { title, description, type: "website", url } };
}

// Every sentence on this page is Challenger-passed sanctioned copy (2026-07-10). Do not add
// stats here without a pass; this page exists so journalists quote us accurately.
const BOILERPLATE =
  "Got Cosy scores hotels for cosiness: the warmth, character and intimacy guests actually feel. " +
  "Our AI reads guest reviews against a fixed rubric and scores each hotel from 0 to 10, with the signals it found. " +
  "Star ratings barely predict any of this, so our lists surface places the usual filters miss. " +
  "We've scored 17,727 hotels across 164 cities, and the grading is honest: nothing clears an 8. " +
  "Browse by city, see the evidence behind the scores, use it free. No signup, methodology public.";

const FACTS: Array<[string, string]> = [
  ["17,727", "hotels scored by reading what guests wrote in reviews, against a fixed rubric"],
  ["164", "cities covered, browsable by city and by theme"],
  ["r = 0.10", "correlation between star rating and our cosiness score across 7,048 hotels: stars barely predict how warm a stay feels"],
  ["1 in 44", "hotels score genuinely cosy, 7.0 or higher out of 10"],
  ["7.8", "the highest score in the dataset. Nothing clears an 8, and we publish the limitations"],
  ["3 out of 4", "hotels in our cosiest towns have guests writing about a person: the owner, someone by name"],
];

export default function PressPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border" style={{ borderColor: "var(--line)", background: "var(--card)", color: "var(--ember-ink)" }}>
        Press kit
      </span>
      <h1 className="mt-4 font-display text-3xl md:text-4xl font-semibold tracking-tight">Writing about Got Cosy</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
        Everything on this page is free to quote with attribution to Got Cosy (gotcosy.com). If you need a custom
        cut of the data for a story, email us and we&apos;ll build it.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold">Boilerplate</h2>
      <p className="mt-2 leading-relaxed rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>{BOILERPLATE}</p>

      <h2 className="mt-10 font-display text-xl font-semibold">The numbers, sourced</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {FACTS.map(([n, t]) => (
          <li key={n} className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--card)" }}>
            <div className="font-display text-2xl font-semibold" style={{ color: "var(--ember-ink)" }}>{n}</div>
            <div className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{t}</div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
        Methodology and free CSVs: <Link className="underline" href="/en/data/cosiest-hotel-towns">the data page</Link> and{" "}
        <Link className="underline" href="/en/cosy-index">the Cosy Index</Link>.
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold">Logos</h2>
      <div className="mt-3 flex flex-wrap items-end gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/press/gotcosy-logo-stacked.svg" alt="Got Cosy stacked logo" width={160} height={160} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/press/gotcosy-seal.svg" alt="Got Cosy seal" width={280} height={80} />
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        Download: <a className="underline" href="/press/gotcosy-logo-stacked.svg">stacked logo (SVG)</a> ·{" "}
        <a className="underline" href="/press/gotcosy-logo-512.png">stacked logo (PNG, 512px)</a> ·{" "}
        <a className="underline" href="/press/gotcosy-seal.svg">seal (SVG)</a>
      </p>

      <h2 className="mt-10 font-display text-xl font-semibold">Contact</h2>
      <p className="mt-2" style={{ color: "var(--muted)" }}>
        Per Winroth, founder. Email <a className="underline" href="mailto:per@gotcosy.com">per@gotcosy.com</a>. One
        person answers, usually the same day.
      </p>
    </div>
  );
}

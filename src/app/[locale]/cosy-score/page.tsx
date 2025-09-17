import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cosy score explained",
  description: "How we estimate the coziness of hotels.",
};

export default function CosyScorePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Cosy score</h1>
      <p className="mt-2 text-zinc-700">A transparent, evolving heuristic to estimate how cosy a place feels.</p>

      <div className="prose prose-zinc mt-6">
        <h2 id="seal">Seal of approval</h2>
        <p>
          We add a small seal badge to places with a <strong>Cosy score of 7.0 or higher</strong>. It’s a simple indicator that the hotel likely delivers that warm, relaxed feel we look for.
          Scores come from a blend of overall rating, amenities warmth, language signals, and small‑scale bonus (see below).
        </p>

        <h2>What goes into the score</h2>
        <ul>
          <li><strong>Overall rating</strong> (out of 10) – normalized and weighted.</li>
          <li><strong>Amenities warmth</strong> – amenities associated with cosiness (e.g., fireplace, bathtub, spa/sauna, garden).</li>
          <li><strong>Language</strong> – descriptive text mentioning cosy/cozy, warm, intimate, quiet, romantic, character, etc.</li>
          <li><strong>Scale</strong> – small/boutique places tend to feel cosier than very large hotels.</li>
        </ul>

        <h2>How we blend it</h2>
        <p>
          We combine the signals into a single <strong>0–10</strong> score. Ratings provide the base, amenities and language nudge cosiness up, and very large scale can apply a small penalty.
          The goal is to surface warm, characterful stays while staying simple and transparent.
        </p>

        <h3>Limitations</h3>
        <p>
          This is a starting point. As we ingest more data (reviews, images), we’ll refine the model with NLP and image signals. Feedback is welcome.
        </p>
      </div>
    </div>
  );
}

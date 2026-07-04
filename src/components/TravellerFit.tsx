// "Best for" — the traveller-facing Traveller Fit section on a hotel page. Server-renderable, no
// client JS. Renders nothing at all when the hotel has no confident concepts, so hotels without
// inference data get zero layout change. All copy is deterministic and honest — it never mentions
// scores, AI, weights or any internal machinery, only what a traveller would search for.
import Link from "next/link";
import { CONCEPT_BY_SLUG, type TravellerFitAssignment } from "@/lib/travellerFit";

// Short chip labels for the "Best for" pills (the concept.label headings are too long for a chip).
const CHIP_LABEL: Record<string, string> = {
  fireplace: "Fireplace", romantic: "Romantic getaways", spa: "Spa", boutique: "Boutique & independent",
  views: "Great views", quiet: "Peace & quiet", "family-friendly": "Families", "pet-friendly": "Dog-friendly",
  design: "Design lovers", "historic-charm": "Historic charm", "hidden-gem": "Hidden gem", "luxury-feel": "A treat",
  rustic: "Rustic escapes", "great-breakfast": "Great breakfast", sauna: "Sauna", bathtub: "A long soak",
  rooftop: "Rooftop", garden: "Garden", pool: "Pool", walkable: "Central & walkable", waterfront: "Waterfront",
};

// Running-copy phrase for the "A strong fit for …" lead sentence (reads naturally in a list).
const FIT_PHRASE: Record<string, string> = {
  fireplace: "cosy nights by the fire", romantic: "a romantic getaway", spa: "a spa break",
  boutique: "boutique character", views: "the view", quiet: "peace and quiet",
  "family-friendly": "a family trip", "pet-friendly": "travelling with a dog", design: "design lovers",
  "historic-charm": "history and character", "hidden-gem": "getting off the beaten track",
  "luxury-feel": "a treat", rustic: "a rustic escape", "great-breakfast": "the breakfast",
  sauna: "a sauna", bathtub: "a long soak", rooftop: "a rooftop", garden: "a garden",
  pool: "a pool", walkable: "walking everywhere", waterfront: "a waterside stay",
};

function chipLabel(slug: string): string {
  return CHIP_LABEL[slug] ?? CONCEPT_BY_SLUG[slug]?.label ?? slug;
}

function fitPhrase(slug: string): string {
  return FIT_PHRASE[slug] ?? chipLabel(slug).toLowerCase();
}

/** "a, b and c" / "a and b" / "a" — Oxford-less, natural list join. */
function joinNatural(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// Lowercase the first letter for a mid-sentence continuation ("The fire" → "the fire"), but leave
// acronyms/brand casing ("B&B", "24-hour") alone.
function midSentence(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/**
 * Deterministic "Why travellers choose it" paragraph: a lead sentence from the top 2–3 displayed
 * concepts, then up to two guest-evidence sentences (near-duplicates dropped), kept under ~50 words.
 * Honest tone — no scores/AI/internals. Returns null when there's nothing worth saying.
 */
export function buildWhyParagraph(displayed: TravellerFitAssignment[]): string | null {
  if (!displayed.length) return null;
  const top = displayed.slice(0, 3).map((a) => fitPhrase(a.concept_id)).filter(Boolean);
  if (!top.length) return null;
  const lead = `A strong fit for ${joinNatural(top)}.`;

  // Best distinct evidence strings (dedup exact + substring/superstring near-duplicates).
  const seen: string[] = [];
  const evidence: string[] = [];
  for (const a of displayed) {
    const raw = (a.evidence_text || "").trim().replace(/\s+/g, " ").replace(/\.+$/, "");
    if (!raw) continue;
    const norm = raw.toLowerCase();
    if (seen.some((s) => s.includes(norm) || norm.includes(s))) continue;
    seen.push(norm);
    evidence.push(raw);
    if (evidence.length >= 2) break;
  }

  const withEvidence = (n: number) =>
    n === 0 ? lead : `${lead} Guests point to ${joinNatural(evidence.slice(0, n).map(midSentence))}.`;

  let out = withEvidence(evidence.length);
  // Trim to ~50 words: prefer dropping the second evidence clause before the first.
  if (out.split(/\s+/).length > 50 && evidence.length > 1) out = withEvidence(1);
  if (out.split(/\s+/).length > 50 && evidence.length > 0) out = withEvidence(0);
  return out;
}

export default function TravellerFit({
  displayed,
  hrefBySlug,
}: {
  displayed: TravellerFitAssignment[];
  /** Resolved collection href per concept slug, or null to render a non-link chip. */
  hrefBySlug: Record<string, string | null>;
}) {
  if (!displayed.length) return null;
  const why = buildWhyParagraph(displayed);
  const chipClass = "rounded-full border px-3 py-1.5 text-sm no-underline";
  return (
    <section className="mt-8">
      <h2 className="font-display text-2xl font-semibold">Best for</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {displayed.map((a) => {
          const label = chipLabel(a.concept_id);
          const href = hrefBySlug[a.concept_id] ?? null;
          const style = {
            borderColor: "var(--line)",
            background: "var(--surface-2)",
            color: href ? "var(--foreground)" : "var(--muted)",
          };
          return href ? (
            <Link key={a.concept_id} href={href} className={chipClass} style={style}>{label}</Link>
          ) : (
            <span key={a.concept_id} className={chipClass} style={style}>{label}</span>
          );
        })}
      </div>
      {why && (
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted)" }}>{why}</p>
      )}
    </section>
  );
}

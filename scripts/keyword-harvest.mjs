// Free AnswerThePublic-style keyword + question harvester via Google Autocomplete (no key, no cost).
// Surfaces real search demand to drive the editorial calendar (city pages, thematic roundups, FAQs).
//
//   node scripts/keyword-harvest.mjs                      # default seeds (cosy/boutique hotels)
//   node scripts/keyword-harvest.mjs "cosy hotels paris"  # one seed, fully expanded
//   node scripts/keyword-harvest.mjs "boutique hotels" gb # seed + country (gl) for localised demand
const SEED = process.argv[2] || null;
const GL = process.argv[3] || "gb"; // country bias (gb|us|...)

const DEFAULT_SEEDS = ["cosy hotels", "cozy hotels", "boutique hotels", "romantic hotel", "cosy weekend break"];
const QUESTIONS = ["are", "what", "which", "why", "how", "where", "when", "is", "can"];
const PREPS = ["in", "near", "with", "for", "without", "under", "by", "around"];
const COMPARE = ["vs", "or", "like", "and"];
const ALPHA = "abcdefghijklmnoprstuvwy".split("");

async function ac(q) {
  try {
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${GL}&q=${encodeURIComponent(q)}`, { headers: { "user-agent": "Mozilla/5.0" } });
    const j = JSON.parse(await r.text());
    return (j[1] || []).map((s) => String(s).toLowerCase().trim());
  } catch { return []; }
}

async function harvestBucket(seed, mods, order /* "after" | "before" */) {
  const out = new Set();
  for (const m of mods) {
    const q = order === "before" ? `${m} ${seed}` : `${seed} ${m}`;
    (await ac(q)).forEach((s) => { if (s.length > 3 && s !== seed) out.add(s); });
  }
  return [...out].sort();
}

async function harvestSeed(seed) {
  const [base, questions, prepositions, comparisons, alpha] = await Promise.all([
    ac(seed),
    harvestBucket(seed, QUESTIONS, "before"),
    harvestBucket(seed, PREPS, "after"),
    harvestBucket(seed, COMPARE, "after"),
    harvestBucket(seed, ALPHA, "after"),
  ]);
  return { seed, base, questions, prepositions, comparisons, alpha };
}

const seeds = SEED ? [SEED] : DEFAULT_SEEDS;
const results = [];
for (const s of seeds) results.push(await harvestSeed(s));

const show = (label, arr) => { if (arr.length) { console.log(`\n  ${label} (${arr.length}):`); arr.slice(0, 40).forEach((x) => console.log(`    · ${x}`)); } };
let total = 0;
for (const r of results) {
  const n = r.base.length + r.questions.length + r.prepositions.length + r.comparisons.length + r.alpha.length;
  total += n;
  console.log(`\n===== "${r.seed}" (gl=${GL}) — ${n} suggestions =====`);
  show("❓ QUESTIONS → FAQ / explainer posts", r.questions);
  show("🔧 WITH/NEAR/FOR → thematic roundup posts", r.prepositions);
  show("⚖️  VS/OR → comparison posts", r.comparisons);
  show("🏙  A–Z (cities/brands/long-tail) → city + long-tail pages", r.alpha);
  show("🔎 base", r.base);
}
console.log(`\nTOTAL: ${total} real queries across ${seeds.length} seed(s). Map: questions→FAQ, with/near→roundups, A–Z→city/long-tail pages.`);

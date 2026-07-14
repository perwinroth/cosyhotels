// Shared copy normalizer for the description pipeline (score-and-describe.mjs) and one-off cleanups.
// Founder copy rule (2026-07-08): the em dash (— U+2014) is BANNED in all reader-facing copy.
// The en dash (– U+2013) is ALLOWED in numeric ranges and is deliberately left untouched here.
// Replaces em dashes with the sanctioned comma, then tidies the spacing/punctuation it leaves behind.
export function stripEmDashes(input) {
  if (input == null) return input;
  let s = String(input);
  if (!s.includes("—")) return s; // fast path: no em dash, nothing to change
  s = s.replace(/\s*—\s*/g, ", "); // em dash (+ surrounding spaces) → comma
  s = s.replace(/\s+([,.;:!?])/g, "$1"); // no space before punctuation
  s = s.replace(/([,;:])\s*[,;:]/g, "$1"); // collapse doubled separators (", ," → ",")
  s = s.replace(/,\s*\./g, "."); // ", ." → "."
  s = s.replace(/\s{2,}/g, " ").trim(); // collapse whitespace
  s = s.replace(/^,\s*/, "").replace(/\s*,$/, "").trim(); // an em dash at the very start/end leaves a stray comma
  return s;
}

// Canonical hotel identity key — the single source of truth for "is this the same hotel?".
// Used by (1) the dedup cleanup, (2) every import path, and (3) the DB unique index
// (hotels.dedup_key) so the catalogue physically cannot refill with duplicates.
// Keep this normalization IN SYNC with the inline copy in scripts/dedup-hotels.mjs and the
// ingest scripts — the DB unique index assumes they all produce the same key.
export function normPart(s?: string | null): string {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

// name|city. Returns "" when there's no name (caller should skip keying rather than store a blank).
export function hotelDedupKey(name?: string | null, city?: string | null): string {
  const n = normPart(name);
  if (!n) return "";
  return `${n}|${normPart(city)}`;
}

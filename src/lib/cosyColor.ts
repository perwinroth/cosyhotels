// Single source of truth for the cosy-score badge colour. Returns a theme-aware CSS variable
// (the --cosy-* tokens defined for both themes in src/app/globals.css), so the score scale always
// matches the UI palette and never drifts when a theme or token changes. Previously this logic was
// hardcoded hex copy-pasted across page.tsx, HotelTile, the facet page and the hotel detail — and
// had already diverged (two different greens for the same score). Import this everywhere instead.
export function cosyBadgeColor(score: number): string {
  if (score >= 9) return "var(--cosy-top)";   // gold
  if (score >= 7.8) return "var(--cosy-high)"; // sage
  if (score >= 6.8) return "var(--cosy-mid)";  // olive
  if (score >= 5.6) return "var(--cosy-mild)"; // clay
  return "var(--cosy-low)";                    // muted
}

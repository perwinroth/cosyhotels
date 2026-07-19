# design-sync notes — cosyhotels

- Next.js APP repo, no dist: build uses --entry .design-sync/ds-entry.ts (named re-exports of the
  4 scoped components). cfg.pkg "." is a placeholder; running WITHOUT --entry fails (ENOENT
  node_modules/package.json).
- tsconfig: .design-sync/tsconfig.json adds paths stubs → .design-sync/stubs/ for next/image,
  next/link, next/navigation, and @/components/HotelActions (sync EN copy of the real server
  component's JSX; update it when HotelActions markup changes).
- Two source hardening edits live in this branch: ShareButton typeof-process guard;
  placeText.ts isLatin regex rewritten to \u escapes (raw CJK regex corrupted under
  windows-1252 script decoding — caused [BUNDLE_EXPORT] failures in the charset-less smoke page).
- CSS: Tailwind v4 — compile first: npx @tailwindcss/cli@4 -i src/app/globals.css -o
  .design-sync/compiled-tw.css, then ds-styles.css = google-fonts @import + compiled css
  (cfg.cssEntry). [FONT_REMOTE] for Inter/Fraunces is expected (Google Fonts at runtime).
- Previews import components via RELATIVE paths ("../../src/components/X") — the story-imports
  shim maps them to window.GotCosy. Package-name imports do NOT resolve (pkg not self-installed).
- CookieConsent renders position:fixed → its preview wraps in a transform:translateZ(0) container;
  cfg.overrides.CookieConsent = single/Banner.
- Default theme is DARK (forest-charcoal) — dark preview cards are CORRECT, not a bug.
- Known render warns: none outstanding after fixes.

## Re-sync risks
- The HotelActions stub duplicates production JSX — drifts silently if HotelActions changes;
  diff it against src/components/HotelActions.tsx on every re-sync.
- compiled-tw.css is generated (gitignored) — recompile before every build or styles go stale.
- SaveToTripButton/ShareButton previews hit no network but the components can (share/save flows);
  render check only proves initial render.
- Worktree-based sync: this ran in /tmp/gc-dsync off origin/main; durable files must be PR'd back
  or they vanish with the worktree.

# Got Cosy? — Brand Spec ("Boutique Nocturne" / "Warm Paper")

Source of truth: `src/app/globals.css` (Tailwind v4 `@theme inline`, no tailwind.config). Two themes:
default DARK ("Boutique Nocturne") + opt-in LIGHT via `[data-theme="light"]` ("Warm Paper").
**Always style through the CSS variables — never the raw hex — so both themes keep working.**
Anything not listed here is forbidden.

## Colors (allowed palette — exhaustive; values shown dark → light)

Surfaces / text:
- `--background` `#0F1512` → `#FAF7F1` — page background
- `--surface-2` `#0B100E` → `#F1EADD` — footer, fills
- `--card` `#18201C` → `#FFFFFF` — raised cards
- `--foreground` `#F3EEE6` → `#1C2420` — body ink
- `--muted` `#9DA89F` → `#6B746C` — secondary text
- `--line` `#2A332D` → `#E6DECF` — hairline borders
- `--header-bg` rgba frosted header

Accents:
- `--ember` `#E08A4B` → `#D2783A` — primary accent / CTA background ("Check availability")
- `--ember-ink` `#E89A5E` → `#B5642A` — amber accent text
- `--sage` `#7FB7A2` → `#4F7E6C` — secondary / success / Seal-of-Approval pill
- `--gold` `#D8B25A` → `#A87F2E` — top score

Cosy-score scale (read ONLY via `cosyBadgeColor()` in `src/lib/cosyColor.ts` — never inline):
- `--cosy-top` (=gold, ≥9) · `--cosy-high` (=sage, ≥7.8) · `--cosy-mid` olive `#7c8a5f`→`#5f6a44` (≥6.8)
- `--cosy-mild` clay `#b07a4a`→`#9a5f30` (≥5.6) · `--cosy-low` `#a89b8c`→`#8c8478`

Literal colors allowed where already used: `#fff` (text on score badges & sage pills), `#16201C`
(dark ink on ember CTA buttons ONLY — decided 2026-07-04: score-badge numbers are WHITE, `#16201C`
on badges was a bug). No other hex/rgb/hsl may be introduced.

## Typography

- Display/headings: **Fraunces** (Google import, wghts 400/500/600/700 + italic 400/500) —
  `h1/h2/h3`, `.font-display`, or inline `fontFamily: 'Fraunces, serif'`
- Body/UI: **Inter** 400/500/600/700 — default via `body`, `--font-sans`
- No next/font — fonts come from the `@import url(...)` at the top of globals.css (keep it FIRST)
- Sizes in use: Tailwind `text-xs/sm/base/lg` + a few fixed px in badges (15/22/23/26/28) — copy the
  sibling element's size, add nothing new

## Spacing & layout

- Cards: `rounded-2xl border p-5` (list) / `p-3` (compact) with `borderColor: var(--line)`,
  `background: var(--card)`, `boxShadow: var(--shadow)`
- Grids: `grid gap-2 sm:grid-cols-2` (compact lists); don't change column counts/breakpoints
- Do not normalize spacing — inconsistencies stay

## Components (canonical versions — always reuse, never fork)

- Hotel card/tile: `src/components/HotelTile.tsx` (score badge 64×64 `rounded-2xl`, Fraunces 26,
  **white** text; sage Seal pill :49; signal chips :66-79 `text-xs px-2 py-0.5 rounded-full border`)
- Peer/graph lists + facet link-pills: `src/components/HotelGraph.tsx` (badge 40×40 `rounded-lg
  text-white`; pills `rounded-full border px-3 py-1.5 text-sm`)
- Traveller-fit chips + "Best for": `src/components/TravellerFit.tsx`
- Score badge color: `cosyBadgeColor()` from `src/lib/cosyColor.ts` — the ONLY way to color a score
- Hotel-page score card: 76×76 `rounded-2xl font-display font-bold`, white number
- CTA button: `rounded-xl px-5 py-3 font-medium text-sm`, `background: var(--ember)`, ink `#16201C`

## Radii / shadows / motion

- Radius: `rounded-2xl` cards & score badges · `rounded-xl` buttons/compact cards ·
  `rounded-lg` small badges · `rounded-full` chips/pills
- Shadows: `var(--shadow)` / `var(--shadow-lg)` only (theme-aware); Tailwind `shadow` class where
  already present on badges
- No entrance animations; keep whatever transitions already exist per element

## Voice

Warm, understated, honest. **"cosy" not "cozy."** No exclamation marks, no hype ("stunning",
"ultimate"), no invented amenities. Review-grounded claims only. Never expose internal scoring
mechanics (weights, dims, formulas) in user-facing copy.

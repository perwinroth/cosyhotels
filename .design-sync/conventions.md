# Got Cosy design conventions

Dark-first: the default theme is deep forest-charcoal (`--background: #0F1512`, cards `#18201C`);
light is the opt-in via `data-theme="light"`. Always style with the CSS custom properties
(`--card`, `--line`, `--muted`, `--ember`, `--sage`, `--cosy-high/mid/low`) — never hardcoded hex.

Type: Fraunces (serif) for display — hotel names, scores; Inter for everything else. Score badges
use Fraunces at weight 600.

Signature element: the cosy score chip/badge — `cosyBadgeColor(score)` background, white text,
rounded-lg (chip, mobile) or rounded-2xl 56px block (desktop). The chip is always FIRST in the
title row on mobile and never a dead left column.

Actions (founder rule 8): action rows are START-aligned in the content column on every card and
every breakpoint — no ml-auto, no justify-end. Mobile: full-width stacked buttons, each >= 44px
tall. >= sm: single inline row, wrap allowed. All controls share the rounded-xl radius family.
Primary CTA is solid `var(--ember)` with white text; secondary is outlined `var(--line)`.

Rank digits (#1, #2) appear ONLY on genuinely ranked lists (search results, "cosiest in X");
curated sections never show numbers. Snippet eyebrows ("WHY IT'S COSY") are uppercase 11px ember.

Copy: British English, no em dashes ever (CI-enforced), sentence case, one job per label.

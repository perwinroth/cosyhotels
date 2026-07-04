---
name: brand-lock
description: Enforces the project's existing design system as READ-ONLY. Use this skill on EVERY task that touches UI code — components, pages, styles, layouts — even if the task is purely functional (bug fix, new feature, refactor, data wiring). It prevents any unrequested changes to colors, typography, spacing, layout structure, border radii, shadows, animations, or component styling. Trigger whenever editing .tsx/.jsx/.css/.scss files, Tailwind classes, theme files, or anything visual. If in doubt whether a task is "UI-related", assume it is and apply this skill.
---

# Brand Lock

The existing design system in this codebase is **locked**. Your job is to change behavior, not appearance. When you finish a task, a visual diff of the site should show ZERO changes except those the user explicitly requested.

## The Prime Directive

> If the user did not explicitly ask for a visual change, do not make one.

"Explicitly" means the request names the visual change ("make this button green", "change the hero layout"). It does NOT mean:
- "Improve this page" → improve function/content, not styling
- "Fix this component" → fix the bug, keep the styling byte-identical
- "This looks broken" → find the minimal CSS/markup fix, don't redesign
- "Add a feature" → build it using existing components and tokens only

## Read-Only Files (never modify unless explicitly asked)

- `tailwind.config.*` / `tailwind.config.ts`
- `globals.css`, `theme.css`, any file defining CSS custom properties (`--*` variables)
- Font imports/config (`next/font`, `@font-face`, layout.tsx font setup)
- Design-token files, `theme.ts`, color constant files
- `references/BRAND.md` in this skill (the brand spec — read it, obey it)

If a task genuinely seems to require editing one of these, STOP and ask the user first. Do not proceed on assumption.

## Hard Rules

1. **No new colors.** Never introduce a hex code, rgb()/hsl() value, or Tailwind color class that doesn't already exist in the codebase. Reuse existing tokens/classes. Grep first: if `#E8A87C` (or whatever) isn't already in the repo, you may not add it.
2. **No new fonts, weights, or sizes.** Use only the typography scale already present. No new `font-*`, `text-*` size classes that aren't already used for equivalent elements.
3. **No layout restructuring.** Do not change grid/flex structure, column counts, breakpoints, container widths, padding/margin values, or element order of existing components. Wrapping/nesting changes required for a functional fix must preserve rendered layout exactly.
4. **No spacing "cleanup".** Do not normalize, round, or "harmonize" spacing values, even if they look inconsistent. Inconsistency may be intentional.
5. **No arbitrary Tailwind values** (`w-[347px]`, `text-[#123456]`, `mt-[13px]`) unless copying an existing pattern verbatim.
6. **No new border radii, shadows, transitions, or animations.** Reuse what exists.
7. **New UI must be assembled from existing components.** Before creating any new component, search `components/` for one that already does the job. If a new component is unavoidable, it must use only existing tokens and match the styling of its nearest sibling component.
8. **No dependency-driven restyling.** Never add a UI library (shadcn, MUI, DaisyUI, etc.) or change CSS methodology to solve a task.
9. **No "while I'm here" edits.** Touch only the lines required by the task. Unrelated styling in the same file is off-limits even if it looks wrong to you.
10. **Copy/tone is brand too.** Don't rewrite headings, microcopy, or brand voice unless asked.

## Required Workflow

**Before editing:**
1. Read `references/BRAND.md` in this skill (if populated) for the project's token list.
2. Open the component/page you'll touch and note its existing classes, tokens, and structure — this is your palette. You may only use what's already there or defined in the theme.

**While editing:**
- For new elements, copy the class list of the closest existing equivalent element and adapt minimally.

**Before finishing (mandatory self-check):**
Run and review:
```bash
git diff -- '*.css' 'tailwind.config*' '*theme*'   # must be EMPTY unless user asked
git diff | grep -iE '#[0-9a-f]{3,8}|rgb\(|hsl\('    # no new raw colors
git diff | grep -E 'text-\[|bg-\[|w-\[|h-\[|m[trbl]?-\[|p[trbl]?-\['  # no new arbitrary values
```
If any of these show unrequested changes: revert them before reporting done.

**In your final summary**, include one line: `Brand-lock check: no unrequested visual changes` (or list the visual changes the user explicitly requested).

## When the user DOES ask for a visual change

Make exactly the change requested, scoped to exactly the elements named. If the change requires a new token (new color, new size), add it to the central theme/token file — never inline — and tell the user you added it.

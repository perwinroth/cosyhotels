---
name: feature
description: Use when building a new feature or making a non-trivial multi-file change. Enforces a Research → Plan → Execute → Test discipline — research first, get the plan approved before editing, implement in TypeScript, then verify and deploy via preview. Keeps work grounded instead of jumping ahead.
---

# Feature workflow: Research → Plan → Execute → Test

Follow these steps in order. Do not skip ahead to implementation before the plan is approved.

## 1. Research
- Read the relevant files and understand the **current** behavior before proposing anything.
- For a bug, **root-cause it first** — diagnose the true cause and explain it before changing any code. No symptom patches.
- State assumptions; surface anything that's hard to reverse.

## 2. Plan
- Present a short, concrete plan: which files change, the approach, and the test/verification step.
- **Wait for approval before editing.** Lock in the currently-working functionality before adding the next thing.

## 3. Execute
- Implement in **TypeScript**, matching existing type conventions and the surrounding code's style.
- Any script that writes to the Supabase/prod DB must be **dry-run by default, back up before writing, and be reversible** (this repo's safe-migration rule).
- `main` auto-deploys to production via Vercel — never leave it broken.

## 4. Test
- Run `npm run build` / typecheck and the relevant tests; verify the change does what was asked.
- Deploy via **preview** and confirm behavior before anything reaches `main`.

## Output style
- Keep responses concise — lead with the outcome, skip filler, don't dump whole files unnecessarily.

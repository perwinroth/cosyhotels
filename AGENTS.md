# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router routes (e.g., `/[locale]/hotels`, API routes).
- `src/components`: Reusable UI components (`.tsx`, PascalCase e.g., `HotelTile.tsx`).
- `src/lib`: Utilities (images, places, scoring, overrides). Add new libs here.
- `src/data`: Static data sources (e.g., hotels, collections).
- `public`: Static assets (images, icons). Refer with `/...` paths.
- `tests` / `playwright.config.ts`: E2E tests and config.
- `supabase`: SQL and local setup.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server (Turbopack).
- `npm run build`: Production build (Next.js 15).
- `npm start`: Run the built app.
- `npm run lint`: Lint TypeScript/React with Next.js config.
- `npx playwright test`: Run Playwright E2E tests.
- `npm run ship --m="msg"`: Stage, commit, rebase, and push.

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`); avoid `any`.
- Components: PascalCase file and export names; default export for pages/components only.
- Modules: Prefer named exports for utilities.
- Styling: Tailwind CSS v4 in `src/app/globals.css`.
- Linting: `eslint-config-next`; fix or carefully disable with comments.

## Testing Guidelines
- Framework: Playwright (`@playwright/test`), optional axe checks (`@axe-core/playwright`).
- Location: Place tests under `tests/` mirroring routes/components.
- Run: `npx playwright test` (update screenshots under `screenshots/` when UI changes).

## Commit & Pull Request Guidelines
- Commits: Short, imperative, scoped when useful (e.g., `feat(hotels): add rank filter`).
- PRs: Clear description, link issues, include screenshots for UI changes, note env/config impacts.
- Keep diffs focused; add minimal docs when introducing new modules.

## Security & Configuration Tips
- Copy `.env.example` → `.env`.
- Required: `NEXT_PUBLIC_SITE_URL`, Supabase keys. Optional: `OPENAI_MODEL`.
- Do not commit secrets. `NEXT_PUBLIC_*` keys are client-visible.
- External API calls live in `src/lib` and should be server-side where possible.

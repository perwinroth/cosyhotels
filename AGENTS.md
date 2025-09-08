# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router routes (e.g., `/[locale]/hotels`, API routes).
- `src/components`: Reusable UI (PascalCase files, `.tsx`).
- `src/lib`: Utilities (scoring, images, places, overrides).
- `src/data`: Static data sources (e.g., hotels, collections).
- `public`: Static assets (images, icons).
- `tests` / `playwright.config.ts`: E2E tests.
- `supabase`: SQL and local setup.

## Build, Test, and Development Commands
- `npm run dev`: Start local dev server with Turbopack.
- `npm run build`: Production build (Next.js 15).
- `npm start`: Run the built app.
- `npm run lint`: Lint TypeScript/React with Next.js config.
- `npx playwright test`: Run Playwright E2E tests.
- `npm run ship --m="msg"`: Stage, commit, rebase, and push (see `scripts/git-ship.sh`).

## Coding Style & Naming Conventions
- Language: TypeScript (`.ts`/`.tsx`), no `any` (`@typescript-eslint/no-explicit-any`).
- Components: PascalCase file and export names (e.g., `HotelTile.tsx`).
- Modules: Named exports preferred; default only for components/pages.
- Styling: Tailwind CSS v4 in `src/app/globals.css`.
- Linting: `eslint-config-next` (CI blocks on errors; fix or disable locally with care).

## Testing Guidelines
- Framework: Playwright (`@playwright/test`), optional axe checks (`@axe-core/playwright`).
- Place tests under `tests/` mirroring route/component structure.
- Run: `npx playwright test`; update screenshots under `screenshots/` as needed.

## Commit & Pull Request Guidelines
- Commits: Short, imperative, scoped when helpful (e.g., `feat(hotels): add rank filter`).
- PRs: Clear description, link issues, include screenshots for UI changes, note env/config impacts.
- Keep diffs focused; add minimal docs when touching new modules.

## Security & Configuration Tips
- Copy `.env.example` → `.env`. Required keys: `NEXT_PUBLIC_SITE_URL`, Supabase keys, `GOOGLE_MAPS_API_KEY`. Optional: `OPENAI_MODEL`.
- Do not commit secrets. Public keys (`NEXT_PUBLIC_*`) are client-visible.
- External API calls live in `src/lib` (e.g., `lib/places.ts`); prefer server-side where possible.

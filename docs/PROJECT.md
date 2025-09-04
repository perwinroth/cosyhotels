# Cosy Hotel Room — Project Overview

## Purpose
- Elevate hotel discovery for travellers who value warmth, character, and comfort.
- Blend objective quality signals with a transparent “Cosy score” to surface intimate, boutique stays.
- Sustain via affiliate partnerships (e.g., Booking.com through Impact) with clear disclosure and privacy.

## Outcomes We’re Aiming For
- Great UX: fast search, clear ranking, clean cards, strong detail pages.
- Trust and transparency: explain how Cosy is computed; show key signals.
- SEO foundations: localized routing, helpful pages (collections, guides), solid metadata.
- Reliable affiliate tracking: outbound links with UTMs/subIDs; click logging for insights.

---

## Tech Stack & Architecture
- Framework: Next.js (App Router) + TypeScript
- Styling: Tailwind CSS (utility-first; `globals.css`)
- i18n: URL locale segment (`/[locale]/…`), message bundles in `src/i18n/messages/*`
- Data: Static seed in `src/data/hotels.ts` + runtime overrides via Supabase
- DB/Infra: Supabase (optional but supported) for overrides and click logs
- Deployment: Vercel recommended (preview + production)

### Key Directories
- `src/app/[locale]/*`: Localized pages (home, hotels, detail, policy, cosy-score)
- `src/lib/`: Core libs: scoring (`scoring/cosy.ts`), affiliate helpers, overrides merge, image utils
- `src/config/`: Site brand and config (`site.ts`)
- `src/data/`: Static seed data (hotels, collections, guides)
- `src/app/api/*`: Minimal APIs (e.g., affiliate import, hotels mock, `/go/[id]` redirect + logging)
- `supabase/`: SQL schema and temp metadata
- `docs/`: Developer/operator docs (Impact integration, this overview)

---

## How Things Work

### Cosy Score (0–10)
- Inputs: rating (normalized), amenities warmth, descriptive language, scale penalty.
- Implementation: `src/lib/scoring/cosy.ts`
  - `amenitiesScore()` sums weights for cosy-related amenities (e.g., fireplace, bathtub, spa).
  - `keywordSentiment()` detects cosy/cozy/warm/intimate/quiet/romantic/character keywords.
  - `scalePenalty()` de‑emphasizes very large hotels; small/boutique isn’t penalized.
  - `cosyScore()` blends signals and clamps to 0..10.
- UI
  - Listings: “Cosy X.Y” badge (color‑coded) + subtle progress bar; default sort by Cosy.
  - Detail: Cosy panel with overall score and breakdown (rating/amenities/keywords/scale) and link to explainer.
  - Explainer page: `/[locale]/cosy-score` documents the heuristic.

### Data Flow
- Base data in `src/data/hotels.ts` (ids, slugs, price, amenities, etc.).
- Affiliate overrides fetched from Supabase (table `affiliate_overrides`) and merged at runtime via `src/lib/overrides.ts`.
- Outbound clicks go through `/go/[id]` (`src/app/go/[id]/route.ts`) which:
  - Builds final affiliate URL with UTMs and optional provider subID (Impact: `subId1`).
  - Logs click metadata to `affiliate_clicks` (best‑effort, if env keys provided).
  - Redirects (302) to the network/merchant URL.

### i18n & SEO
- Localized routes: `src/app/[locale]/…` with `locales.ts` and message bundles.
- Metadata: defaults in layout; per‑page metadata with OpenGraph/Twitter images.
- JSON‑LD: Hotel + Breadcrumb; includes `additionalProperty` for `CosyScore`.
- Sitemap + Robots: `src/app/sitemap.ts`, `src/app/robots.ts`.

### Styling & Accessibility
- Tailwind utilities in `globals.css`.
- Cards/buttons use high‑contrast colors; badges have titles/ARIA labels.
- Cards include `data-cosy` for testing/analytics hooks.

---

## Configuration & Environment
- Domain: `https://cosyhotelroom.com` (set `NEXT_PUBLIC_SITE_URL` in `.env`).
- Analytics: `NEXT_PUBLIC_GA_ID` (optional).
- Supabase (optional but recommended for persistence):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  - Schema in `supabase/schema.sql`.

---

## Affiliate Integration (Impact + Booking.com)
- Guide: `docs/impact-booking.md`.
- Provider subID mapping: `src/lib/affiliates.ts` supports `provider=impact&clickId=…` → `subId1`.
- All CTAs include UTMs (`utm_source`, `utm_medium`, `utm_campaign`) and `rel="sponsored nofollow"`.
- Override links per hotel via `affiliate_overrides` or the JSON import endpoint `POST /api/affiliate/import`.

---

## Important Pages & Routes
- `/[locale]` — Home
- `/[locale]/hotels` — Listings (filters, sorting; default sort = Cosy desc)
- `/[locale]/hotels/[slug]` — Detail with Cosy panel + JSON‑LD
- `/[locale]/cosy-score` — Cosy explainer
- `/[locale]/privacy`, `/[locale]/disclosure` — Compliance pages
- `/go/[id]` — Affiliate redirect + logging
- `/api/affiliate/import` — Import/preview overrides (no persistence beyond Supabase table writes)

---

## Operator Tasks / Workflows
- Local dev: `npm install` → `npm run dev`
- Lint/build (CI): Vercel or GitHub Actions (`.github/workflows/ci.yml`)
- Add/override affiliate link for a hotel:
  1) Create Impact tracking link (destination: Booking.com property/search URL)
  2) Upsert into `affiliate_overrides` (or POST to `/api/affiliate/import`)
  3) Verify `/go/[id]?provider=impact&clickId=test` redirects and logs; check Impact reports
- Content: edit `src/data/*` for curated copy and collections/guides

---

## Roadmap (Next)
- City pages with server pagination and richer filters (Supabase‑backed)
- Ingestion pipeline for external sources (extend `/api/ingest/places` from scaffold)
- Admin curation screen to approve candidates and recompute Cosy (cron)
- Image support: remote hotel images and basic optimization
- Testing: add component + E2E smoke tests on critical flows
- Analytics: GA pageviews + custom events (filter usage, CTA clicks)

---

## Decision Log (light)
- Default sort by Cosy for brand differentiation.
- Transparent Cosy computation; expose key parts of the score.
- Impact as the first affiliate network (Booking.com), with subID tagging.

---

## Contact / Ownership
- Product/domain: cosyhotelroom.com
- Support: support@cosyhotelroom.com


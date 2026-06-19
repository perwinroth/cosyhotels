# EXECUTION_PLAN.md

Coordinator boot-sequence output. Written **before** any code, per the orchestration spec.

> **Status: BLOCKED pending 3 decisions** (see §6). The spec was written against a data
> model that no longer matches this codebase. Firing the swarm as-written would build the
> wrong thing (duplicate affiliate layer, mass writes to a table that is no longer the
> source of truth, a re-implementation of an already-existing city-guide system).

---

## 1. Current state (verified by reading the code)

**Stack:** Next.js 15.5 (App Router, `--turbopack`), React 19, TypeScript 5, Tailwind 4,
Supabase JS 2.57, `@anthropic-ai/sdk` 0.104. Deployed on Vercel. i18n: 7 locales
(`en, de, es, fr, it, pt` + index) under `/[locale]/…`.

**The app runs on TWO parallel data architectures:**

### A. Live OSM path — the CURRENT primary experience
- `/[locale]/hotels` (listing) and the homepage both call `osmSearchHotels(city)`
  (`src/lib/vendors/osm.ts`) → Overpass/Nominatim, live, no API key, no DB.
- Ranked by a synchronous heuristic `osmCosyScore` (`src/lib/scoring/osmCosy.ts`).
- Tiles get `osm-…` slugs. Images via `resolveHotelImage` (`hotelImageFree.ts`).
- Detail page (`hotels/[slug]/page.tsx`): `osm-` slugs render from **query params** +
  a live Claude score cached 7 days (`unstable_cache`). **Nothing is persisted.**
- Recent commits confirm the pivot: "homepage uses live OSM cosy picks, drop stale
  featured_top table"; "live Claude scoring on OSM hotel detail pages".

### B. Supabase path — legacy / secondary, possibly unpopulated
- `guides/[slug]` city-guide pages query the Supabase `hotels` + `cosy_scores` +
  `hotel_images` tables.
- Non-`osm-`/non-`am-` hotel detail slugs read from Supabase.
- Admin/cron routes operate on Supabase `hotels`: `recompute-scores`,
  `recompute-normalized`, `backfill-images`, `ensure-featured`, etc.
- **UNKNOWN: whether `public.hotels` actually contains rows.** Could not verify — env
  reads are sandbox-blocked and the DB needs network + service key. Given the OSM pivot,
  it may be empty or stale. **This is the single biggest risk to Phases 1, 2, 4.**

**Schema (from `supabase/*.sql`):** `hotels`, `hotel_images` (separate table — there is
**no `image_url` column on `hotels`**), `hotel_reviews`, `price_snapshots`,
`cosy_scores` (Claude fields added in `2026_claude_cosy_scores.sql`), `normalizer_stats`,
`city_top`, `featured_top` (being deprecated), `shortlists`, `translations`,
`hotel_slug_redirects`, `job_runs`, `affiliate_overrides`, `affiliate_clicks`.
**No `stay22_link` column. No `growth_log` table.**

**Affiliate monetization (already built):** outbound links are wrapped via **Travelpayouts**
(`src/lib/affiliates.ts` → `https://tp.media/r?marker=740458&p=4115&u=…`, Booking program).
`bookingSearchUrl()` / `expediaSearchUrl()` build the base URLs; `/go/[id]` is a redirect
route. **The spec's Stay22 layer would compete with / duplicate this.**

**City guides already exist:** `src/data/cityGuides.ts` (25 cities) + `src/data/guides.ts`
(editorial). `guides/[slug]/page.tsx` already renders top hotels from Supabase and emits
**ItemList + Article JSON-LD**. So "Phase 2 — programmatic city pages" is largely already
built (just Supabase-sourced).

**Env (from `.env.example`, partial — file is sandbox-read-blocked):** confirmed present at
runtime: `ANTHROPIC_API_KEY` (doctor). Code references: `NEXT_PUBLIC_SUPABASE_URL`/
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `COSY_SCORING_MODEL`,
`NEXT_PUBLIC_AFFILIATE_NETWORK`. **Not referenced anywhere:** `STAY22_AID`,
`GOOGLE_INDEXING_KEY`, `BING_API_KEY`, `GOOGLE_SEARCH_CONSOLE_KEY` — all four are new.

**No `CONTEXT.md` exists** (the spec told the Coordinator to read it).

---

## 2. Built vs missing (per spec phase)

| Phase | Spec assumes | Reality | Verdict |
|------|--------------|---------|---------|
| 0 Stay22 | `hotels.stay22_link` col; booking links to wrap | No col; links already wrapped via Travelpayouts; OSM hotels have no DB row | **Conflict — needs decision** |
| 1 Images | `hotels.image_url` null/placeholder | No such col; images in `hotel_images`; backfill route already exists; OSM path resolves images live | **Partly built; target table may be empty** |
| 2 City pages | No city pages; query Supabase for cities w/ 3+ hotels | 25 city guides already exist w/ JSON-LD; Supabase-sourced | **Largely already built** |
| 3 GEO | Pages lack FAQ/Article/OG/sitemap | Article+ItemList JSON-LD present; OG present; sitemap present. No FAQPage schema, no TL;DR block | **Real, scoped gaps — safe to do** |
| 4 Cron | node-cron; `growth_log` table; GSC key | Vercel cron already used (`/api/cron/*`); `node-cron` not installed (wrong model for Vercel); no `growth_log`; no GSC key | **Re-scope to Vercel cron** |

---

## 3. Corrected, reality-based plan (proposed — NOT yet executed)

**Phase 3 (GEO gaps) is the only phase that is safe, additive, and unambiguous today.**
Concretely:
- Add **FAQPage JSON-LD** + a visible FAQ block to `guides/[slug]` city guides.
- Add **TL;DR** (2 sentences) at the top of city guides.
- Verify OG tags on guides/hotels (mostly present; fill `og:image` where missing).
- Confirm sitemap completeness (already covers locales × guides × hotels).
- All server-rendered, no DB writes, no external publishing. Testable via `next build`.

**Phase 4** → if wanted, implement as a **Vercel cron** (`vercel.json` `crons` +
`/api/cron/grow`), NOT `node-cron` (which doesn't fit serverless). Gate every external
call on its env key; skip+log when absent. Create `growth_log` via a new
`supabase/2026_growth_log.sql` migration (applied by the user, not auto-run).

**Phases 0/1/2** depend on the decisions in §6 — cannot be planned concretely until then.

---

## 4. Agent / swarm allocation (once unblocked)

Per spec roles. To be honest about cost: this project's "cheaper Ruflo agents" would be
spawned via the Agent tool with `model: haiku`/`sonnet`. I will only spawn them for
genuinely parallelizable, well-scoped work (e.g. per-city guide content, per-page GEO
fixes). Phase 3 GEO is the natural first fan-out: one agent per N guide files.

---

## 5. Risks & dependencies

1. **Supabase `hotels` may be empty** → Phases 1/2/4 no-op. **Must verify first.**
2. **Stay22 vs Travelpayouts** → adding Stay22 without removing/strategising Travelpayouts
   creates two competing affiliate wrappers. Business decision.
3. **OSM hotels are ephemeral** → there is no stable DB row to store `stay22_link` or
   `image_url` against; the spec's per-hotel DB writes don't map onto the live path.
4. **Outward-facing/irreversible:** Google/Bing indexing submissions, mass DB writes.
   These require explicit go-ahead and present credentials.
5. **Sandbox blocks** `.env` reads and several Bash commands → fully autonomous,
   no-prompt execution (dev server, curl, npm install, DB queries) is not currently
   possible without permission grants.

---

## 6. DECISIONS REQUIRED before Phase 0 (blocking)

1. **Is `public.hotels` populated, and is it still the source of truth — or is the site
   now fully OSM-live?** This determines whether Phases 1/2/4 have anything to act on.
2. **Stay22 or Travelpayouts?** Replace, run both, or skip Stay22?
3. **Scope:** Do the safe, already-valuable **Phase 3 GEO pass now**, or wait until 1–2
   are decided and do everything together?

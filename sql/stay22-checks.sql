-- Stay22 CTA-swap gate (founder FINAL rule, 2026-07-16, verbatim intent: "website only when 22 is
-- wrong, so you need to know"). Founder-run separately in the Supabase SQL editor; the application
-- code (src/lib/ctaPolicy.ts getStay22WrongSlugs) already works without this table — a missing
-- table is a query error, and that fails safe to an EMPTY set, so every hotel just keeps rendering
-- today's default Stay22 "Check availability" CTA until this migration runs.
--
-- Origin: a real-browser sweep of Stay22's "Check availability" link (die-validation
-- data/stay22-verdicts.json) is classifying each hotel's landing page: EXACT / SELECTED /
-- WRONG_PROPERTY / CITY_SEARCH / UNMATCHED_SEARCH / PENDING. Only WRONG_PROPERTY, CITY_SEARCH and
-- UNMATCHED_SEARCH count as "verified wrong" for the CTA swap (src/lib/ctaPolicy.ts
-- STAY22_WRONG_VERDICTS) — EXACT/SELECTED are a confirmed-good landing, PENDING/absent means "not
-- checked yet", and both must leave the default CTA untouched.
--
-- After this runs: node --env-file=.env.local scripts/import-stay22-verdicts.mjs --execute
create table if not exists public.stay22_checks (
  slug text primary key,
  verdict text,
  note text,
  checked_at timestamptz default now()
);

-- getStay22WrongSlugs selects every row (small table, one row per checked hotel) with no filter, so
-- no query index is needed beyond the primary key; nothing further to add here.

alter table public.stay22_checks enable row level security;
-- Service key bypasses RLS (server-only access via getServerSupabase); no anon policies needed —
-- this table is never read directly from the client, only through getStay22WrongSlugs.

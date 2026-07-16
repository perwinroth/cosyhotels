-- Founder eyeball-verification gate (2026-07-16). An automated Haiku pass judged ~12k hotels'
-- stored websites (die-validation data/hotel-link-verdicts.json: SAME_HOTEL / SAME_GROUP /
-- DIFFERENT / HIJACKED / CITY_MISMATCH / INSUFFICIENT_EVIDENCE / MODEL_ERROR). The founder demands
-- 100% accuracy on outreach: a hotel may only be pitched once a HUMAN has looked at the stored
-- link and confirmed it. This table is the record of that human decision.
--
-- Founder-run separately in the Supabase SQL editor. After this, run (in order):
--   1. node --env-file=.env.local scripts/import-link-verdicts.mjs --execute   (loads auto_* facts)
--   2. Work the board at /growth/verify (?key=<PANEL_KEY> once, then it remembers you)
--
-- founder_status starts 'pending' for every row the import script creates; only a human click on
-- /growth/verify (via POST /api/admin/hotel-verifications) ever moves it to verified/rejected.
-- Outreach gate (src/app/api/cron/outreach-sync/route.ts, scripts/seed-email-outreach.mjs,
-- scripts/seed-ig-outreach.mjs) FAILS CLOSED if this table doesn't exist: zero hotels processed,
-- not "process everything"; see src/lib/verificationGate.ts.
create table if not exists public.hotel_verifications (
  hotel_id uuid primary key references public.hotels(id),
  slug text,
  auto_verdict text,
  auto_confidence numeric,
  auto_evidence text,
  auto_at timestamptz,
  founder_status text not null default 'pending' check (founder_status in ('pending', 'verified', 'rejected')),
  founder_at timestamptz,
  updated_at timestamptz default now()
);

-- The board's default view (hotels needing eyes) and the outreach gate both filter on this column
-- constantly; index it so both stay fast as the table grows to the full ~12k-hotel universe.
create index if not exists idx_hotel_verifications_founder_status
  on public.hotel_verifications (founder_status);

alter table public.hotel_verifications enable row level security;
-- Service key bypasses RLS (server-only access via getServerSupabase); no anon policies needed,
-- this table is never read directly from the client; only through /growth/verify (panel-gated)
-- and /api/admin/hotel-verifications (panel-gated + service key).

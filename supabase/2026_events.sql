-- In-app analytics events — the foundation for the /growth funnel dashboard.
-- One row per tracked interaction (pageview, cta_click). Attribution columns let us build
-- per-source funnels (source → visit → CTA click) without depending on Vercel/GA APIs.
-- DDL must be applied in the Supabase SQL editor (PostgREST can't run DDL).
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  type        text not null,                 -- 'pageview' | 'cta_click'
  path        text,                          -- e.g. /en/guides/paris-cosy-hotel
  source      text,                          -- utm_source (pinterest | instagram | google | direct…)
  medium      text,                          -- utm_medium
  campaign    text,                          -- utm_campaign
  city        text,                          -- city context where known
  hotel       text,                          -- hotel name for cta_click
  cta         text,                          -- which CTA (e.g. check_availability)
  visitor     text,                          -- anonymous first-party id (cookie) for unique counts
  referrer    text                           -- document.referrer host
);

create index if not exists events_ts_idx on public.events(ts);
create index if not exists events_type_ts_idx on public.events(type, ts);
create index if not exists events_source_idx on public.events(source);
create index if not exists events_visitor_idx on public.events(visitor);

-- Owner-only data: RLS on with NO policies so the anon key is denied; the app writes via the
-- service-role key (getServerSupabase), which bypasses RLS. Keeps the Supabase advisory clean.
alter table public.events enable row level security;

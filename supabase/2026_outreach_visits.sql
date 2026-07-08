-- First-party outreach-visit counter (pre-registered v3 outcome metric). GSC cannot see
-- email-driven visits and Vercel's log retention is 1 hour, so landings that arrive with
-- utm_source=outreach are logged here durably by /api/track/outreach (once per session).
-- Server-side with the service-role key; RLS on + no policies = deny-all for anon/authenticated.
create table if not exists public.outreach_visits (
  id           bigint generated always as identity primary key,
  path         text,
  utm_source   text,
  utm_campaign text,
  referrer     text,
  created_at   timestamptz default now()
);

alter table public.outreach_visits enable row level security;

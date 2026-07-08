-- Status per /growth/listings target (targets themselves live in src/data/listingTargets.ts).
-- Run once in the Supabase SQL editor, same as 2026_outreach_visits.sql.
create table if not exists listing_status (
  id text primary key,
  status text not null default 'queued' check (status in ('queued', 'submitted', 'live', 'skip')),
  updated_at timestamptz not null default now()
);
alter table listing_status enable row level security;
-- Service-role key (server routes) bypasses RLS; no public policies on purpose.

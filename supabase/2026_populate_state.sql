-- Tracks the auto-populate cron's progress per city (so it resumes, never repeats) and
-- accumulates an approximate scoring spend for the budget cap. Safe to re-run.
create table if not exists public.populate_state (
  city text primary key,
  tier int,
  ingested_at timestamptz,
  scored_at timestamptz,
  hotels_ingested int default 0,
  hotels_scored int default 0,
  status text default 'pending',   -- pending | ingested | done | error
  note text
);

-- Single-row running tally of approximate USD spent on scoring (for the spend cap).
create table if not exists public.populate_budget (
  id int primary key default 1,
  spent_usd numeric not null default 0,
  reviews_spent_usd numeric not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.populate_budget (id, spent_usd) values (1, 0) on conflict (id) do nothing;
-- For DBs created before reviews enrichment:
alter table public.populate_budget add column if not exists reviews_spent_usd numeric not null default 0;

alter table public.populate_state enable row level security;
alter table public.populate_budget enable row level security;

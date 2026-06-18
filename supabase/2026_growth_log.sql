-- Growth log for the self-improving weekly cron (/api/cron/grow).
-- One row per cron run: what it found and what it acted on. Safe to re-run.
create table if not exists public.growth_log (
  id uuid primary key default gen_random_uuid(),
  run_date date not null default current_date,
  pages_created integer not null default 0,
  top_cities text[] default '{}',        -- best-performing city patterns (from GSC, if available)
  gaps_identified text[] default '{}',   -- cities with hotels but no guide page yet
  errors text[] default '{}',
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_growth_log_created on public.growth_log (created_at desc);
alter table public.growth_log enable row level security;

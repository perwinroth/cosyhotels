-- Hotelier submissions from the /for-hotels page. Each row = one self-submitted hotel that
-- was run through the Claude cosy scorer. Also a data source for the future learning loop
-- (ground-truth candidates + drift signal). Safe to re-run.
create table if not exists public.hotel_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text,
  website text,
  description text,
  amenities text[],
  score_100 numeric,
  score_10 numeric,
  signals text[],
  penalties text[],
  ai_description text,
  confidence text,
  model text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hotel_submissions_created on public.hotel_submissions (created_at desc);
alter table public.hotel_submissions enable row level security;

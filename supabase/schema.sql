-- Run this SQL in your Supabase project's SQL editor

-- Affiliate overrides for hotel data coming from partner feeds
create table if not exists public.affiliate_overrides (
  id uuid primary key default gen_random_uuid(),
  hotel_id text,
  slug text,
  affiliate_url text,
  price numeric,
  provider text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_affiliate_overrides_slug on public.affiliate_overrides (slug);
create index if not exists idx_affiliate_overrides_hotel_id on public.affiliate_overrides (hotel_id);

-- Affiliate click logs
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  hotel_id text,
  slug text,
  provider text,
  click_id text,
  target_url text,
  referer text,
  user_agent text,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists idx_affiliate_clicks_slug on public.affiliate_clicks (slug);
create index if not exists idx_affiliate_clicks_created on public.affiliate_clicks (created_at desc);

-- (Optional) RLS policies — keep it simple for now: allow service role only
alter table public.affiliate_overrides enable row level security;
alter table public.affiliate_clicks enable row level security;
-- Service key bypasses RLS. For anon, create explicit policies if needed.


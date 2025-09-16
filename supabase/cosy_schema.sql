-- Core entities
create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  source_id text,              -- id in provider feed
  source text not null,        -- e.g. 'google-places', 'booking', 'expedia'
  slug text unique,
  name text not null,
  address text,
  city text,
  country text,
  lat double precision,
  lng double precision,
  stars numeric,
  rating numeric,
  reviews_count integer,
  rooms_count integer,
  amenities text[],
  description text,
  website text,
  affiliate_url text,
  curated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hotels_source on public.hotels(source, source_id);
create index if not exists idx_hotels_city on public.hotels(city);

create table if not exists public.hotel_images (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  url text not null,
  width integer,
  height integer,
  attributions text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hotel_images_hotel on public.hotel_images(hotel_id);

create table if not exists public.hotel_reviews (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  source text not null,
  rating numeric,
  text text,
  language text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hotel_reviews_hotel on public.hotel_reviews(hotel_id);

create table if not exists public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  currency text default 'USD',
  price numeric,
  collected_at timestamptz not null default now()
);
create index if not exists idx_price_snapshots_hotel on public.price_snapshots(hotel_id);

-- Scoring
create table if not exists public.cosy_scores (
  hotel_id uuid primary key references public.hotels(id) on delete cascade,
  score numeric not null,
  score_final numeric,
  amenities_score numeric,
  review_sentiment numeric,
  imagery_warmth numeric,
  scale_penalty numeric,
  notes text,
  computed_at timestamptz not null default now()
);

-- Simple jobs log
create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'started',
  details jsonb
);

-- RLS (keep simple: enabled, rely on service role for writes)
alter table public.hotels enable row level security;
alter table public.hotel_images enable row level security;
alter table public.hotel_reviews enable row level security;
alter table public.price_snapshots enable row level security;
alter table public.cosy_scores enable row level security;
alter table public.job_runs enable row level security;

-- Normalization stats per city/country (robust median/IQR over base scores)
create table if not exists public.normalizer_stats (
  scope text not null,                 -- 'city' | 'country'
  key text not null,                   -- e.g., 'Paris' or 'Japan'
  median numeric not null,
  iqr numeric not null,
  n integer not null default 0,
  computed_at timestamptz not null default now(),
  primary key (scope, key)
);
alter table public.normalizer_stats enable row level security;

-- Old slug → new slug redirects (for SEO-safe migration)
create table if not exists public.hotel_slug_redirects (
  old_slug text primary key,
  new_slug text not null,
  hotel_id uuid references public.hotels(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_hotel_slug_redirects_new on public.hotel_slug_redirects(new_slug);
alter table public.hotel_slug_redirects enable row level security;

-- Featured front page picks (persisted top list)
create table if not exists public.featured_top (
  position integer primary key,
  hotel_id uuid references public.hotels(id) on delete cascade,
  score numeric not null,
  image_url text
);
create index if not exists idx_featured_top_hotel on public.featured_top(hotel_id);
alter table public.featured_top enable row level security;

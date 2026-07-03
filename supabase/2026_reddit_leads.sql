-- Reddit lead-finder (WP5): threads where people ask for cosy/boutique hotel recommendations in
-- cities we cover, surfaced in /growth so Per can reply MANUALLY (ban-safe — we never auto-post).
-- Found via Apify's Google-search actor (site:reddit.com …), which dodges Reddit's API/IP block.
-- Server-side with the service-role key; RLS on + no policies = deny-all for anon/authenticated.
create table if not exists public.reddit_leads (
  id         text primary key,          -- reddit post id (from /comments/{id}/)
  subreddit  text,
  title      text,
  url        text not null,
  snippet    text,
  query      text,                       -- the search that surfaced it
  city       text,
  status     text not null default 'new',-- new | replied | dismissed
  found_at   timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reddit_leads enable row level security;

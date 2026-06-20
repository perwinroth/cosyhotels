-- Hotel social handles, so published city carousels can @mention featured hotels (they're
-- likely to repost "we're a top-scored cosy stay in {city}" → free reach). Resolved lazily
-- from each hotel's own website (footer/header instagram.com link) for the ~5 hotels we
-- actually feature per city — checked once, stored, reused. NULL handle + a checked_at means
-- "looked, none found" (don't re-scrape); both NULL means "not yet looked".
alter table public.hotels
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists tiktok text,
  add column if not exists threads text,   -- usually == instagram handle (Meta shares usernames)
  add column if not exists social_checked_at timestamptz;

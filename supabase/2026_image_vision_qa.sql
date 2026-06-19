-- Image content-QA: store a per-image vision verdict so non-photo junk (logos, review
-- badges, maps, casino shots) never reaches the social carousels. Populated by
-- /api/cron/vision-qa (Claude Haiku vision). Checked once, stored, served — never per visitor.
--
-- vision_ok:        true = verified real hotel photo; false = junk/unrelated (kept for audit,
--                   hidden from carousels); null = not yet checked.
-- vision_label:     the classifier's category (room|exterior|interior|amenity|logo|badge|map|food|unrelated|unloadable).
-- vision_checked_at: when it was classified (also the "already processed" guard for the sweep).
alter table public.hotel_images
  add column if not exists vision_ok boolean,
  add column if not exists vision_label text,
  add column if not exists vision_checked_at timestamptz;

-- Sweep walks unchecked rows; carousels filter on the verdict.
create index if not exists idx_hotel_images_vision_unchecked
  on public.hotel_images (vision_checked_at) where vision_checked_at is null;
create index if not exists idx_hotel_images_vision_ok
  on public.hotel_images (vision_ok);

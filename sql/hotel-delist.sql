-- Hotel takedown mechanism, layer 2 (trust fix, 2026-07-16). Founder-run separately in the
-- Supabase SQL editor; the application code (src/lib/delisted.ts) already works without this via
-- the code-level DELISTED_SLUGS Set and reads delisted_at defensively (falls back to the Set alone
-- if this column doesn't exist yet), so there is no urgency/ordering dependency running this.
--
-- Origin: brae-lodge (a real, small direct-booking guest house) asked for takedown because our
-- hotel page's only booking CTA (Stay22 "roam") matches the nearest OTA-bookable property, which
-- for small direct-booking hotels can land on a DIFFERENT hotel. Founder promised 24h takedown.
alter table public.hotels add column if not exists delisted_at timestamptz;

-- Partial index: cheap lookups/filters for the (small, hopefully rare) set of delisted hotels,
-- without adding overhead to every other query against hotels.
create index if not exists idx_hotels_delisted_at
  on public.hotels (delisted_at)
  where delisted_at is not null;

-- Delist brae-lodge now. Idempotent and re-run-safe: only sets delisted_at the first time, so a
-- second run of this script never bumps the timestamp on an already-delisted row.
update public.hotels set delisted_at = now() where slug = 'brae-lodge' and delisted_at is null;

-- Duplicate-prevention gate. After the catalogue is deduped, this makes refilling with
-- duplicates structurally impossible: a unique index on a canonical name|city key.
-- Every import sets dedup_key (via src/lib/dedupeKey.ts / the script's matching norm) and
-- upserts on conflict, so re-importing a known hotel UPDATES it instead of duplicating.
--
-- ORDER MATTERS: run AFTER scripts/dedup-hotels.mjs --execute has removed the existing dupes
-- (a unique index can't be created while duplicates exist) AND after dedup_key is backfilled
-- (scripts/dedup-hotels.mjs --backfill-keys). If the index creation errors with a duplicate
-- key, dedup isn't complete yet.

alter table public.hotels add column if not exists dedup_key text;

-- Unique only where set (NULLs allowed) so legacy rows without a key don't block the index.
create unique index if not exists hotels_dedup_key_uniq
  on public.hotels(dedup_key) where dedup_key is not null;

-- Geographic-identity backstop for the hotels table.
--
-- The real duplicate-prevention is the RUNTIME gate (src/lib/hotelIdentity.ts resolveExisting,
-- called by every ingest path) plus the CI guard (scripts/test-no-dupes.mjs). This column is an
-- optional structural belt-and-suspenders: a coarse ~78m geo-cell + primary-name-token key that
-- makes the "is this hotel already here?" lookup cheap and blocks the obvious same-cell double
-- insert under a race.
--
-- It is intentionally a NON-unique index: two genuinely different hotels can share a cell+token,
-- and we never want the DB to hard-reject a real new hotel — the runtime gate makes that call.
-- Apply via the Supabase SQL editor or CLI.

alter table public.hotels add column if not exists geo_name_key text;

create index if not exists hotels_geo_name_key_idx
  on public.hotels (geo_name_key) where geo_name_key is not null;

-- Backfill is done from the app (src/lib/hotelIdentity.ts geoNameKey) on next ingest, or run a
-- one-off script if you want every existing row keyed immediately. Not required for correctness.

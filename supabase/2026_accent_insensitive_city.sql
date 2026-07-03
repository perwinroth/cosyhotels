-- Accent-insensitive city matching so facet/guide pages find hotels stored with diacritics
-- (DB has "Málaga"/"Brașov"/"Montréal"/"Luzern" while resolveCity returns unaccented forms, and a
-- plain ilike is accent-sensitive → those pages 404'd / guides were thin-noindexed).
-- Applied to prod 2026-07-03 (migration name: accent_insensitive_city_lookup). Used by
-- src/lib/seo/cityHotels.ts (loadCityCosyHotels + liveCosyCountForCityName). Reverse: drop the two
-- functions (the extension can stay).
create extension if not exists unaccent with schema extensions;

create or replace function public.cosy_city_hotels(q text)
returns table (
  hotel_id uuid, score numeric, score_final numeric, signals text[], description text,
  slug text, name text, name_en text, city text, country text, lat double precision, lng double precision
) language sql stable security definer set search_path = public, extensions as $$
  select cs.hotel_id, cs.score, cs.score_final, cs.signals, cs.description,
         h.slug, h.name, h.name_en, h.city, h.country, h.lat, h.lng
  from cosy_scores cs join hotels h on h.id = cs.hotel_id
  where cs.score >= 5 and h.city is not null
    and extensions.unaccent(lower(h.city)) like ('%' || extensions.unaccent(lower(q)) || '%')
  order by cs.score desc nulls last
  limit 80;
$$;

create or replace function public.cosy_city_count(q text)
returns integer language sql stable security definer set search_path = public, extensions as $$
  select count(*)::int
  from cosy_scores cs join hotels h on h.id = cs.hotel_id
  where cs.score >= 5 and h.city is not null
    and extensions.unaccent(lower(h.city)) like ('%' || extensions.unaccent(lower(q)) || '%');
$$;

grant execute on function public.cosy_city_hotels(text) to anon, authenticated, service_role;
grant execute on function public.cosy_city_count(text) to anon, authenticated, service_role;

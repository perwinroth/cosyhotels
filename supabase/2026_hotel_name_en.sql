-- Romanized/English display name for non-Latin hotel names (Japanese, Chinese, Korean, …),
-- so they can appear on the English site instead of being filtered out. Populated by
-- /api/cron/transliterate-names (Claude Haiku → Hepburn romaji / pinyin / etc.).
alter table public.hotels add column if not exists name_en text;

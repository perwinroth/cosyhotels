-- Add Claude scoring outputs to cosy_scores.
-- The live cosy_scores table has already drifted from cosy_schema.sql (it carries
-- raw_score / calibrated_score / chain_penalty / review_conf written by the
-- recompute-scores route). This migration only ADDS the Claude fields and is safe to
-- re-run.
--
-- Scale convention after this change:
--   score        numeric  -- 0..10, used by UI badges, JSON-LD, the ≥7 front-data guard,
--                            and as the normalization input (unchanged meaning)
--   raw_score    numeric  -- 0..10 (kept as-is so recompute-normalized keeps working)
--   score_100    numeric  -- 0..100, the Claude raw score (new)
--   signals      text[]   -- user-facing cosy signals
--   penalties    text[]   -- internal anti-cosy signals
--   description  text     -- one-line user-facing blurb
--   confidence   text     -- 'low' | 'medium' | 'high'
--   score_model  text     -- e.g. 'claude-sonnet-4-6'
--   scored_at    timestamptz

alter table public.cosy_scores add column if not exists score_100   numeric;
alter table public.cosy_scores add column if not exists signals     text[];
alter table public.cosy_scores add column if not exists penalties   text[];
alter table public.cosy_scores add column if not exists description text;
alter table public.cosy_scores add column if not exists confidence  text;
alter table public.cosy_scores add column if not exists score_model text;
alter table public.cosy_scores add column if not exists scored_at   timestamptz;

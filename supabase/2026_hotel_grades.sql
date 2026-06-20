-- Human cosiness/link labels — the ground-truth eval set behind the cosy score.
-- One row per hotel (latest human verdict wins; re-grading upserts). Two judgments:
--   cosy_verdict — does the cosy SCORE feel right?  'good' | 'too_high' | 'too_low' | 'unsure'
--   link_ok      — is this the RIGHT hotel in the RIGHT city? (null = not assessed)
-- We snapshot the AI score/confidence at grade time so the label stays meaningful even
-- after a re-score, and so we can measure agreement and feed disagreements back as
-- few-shot calibration anchors into the scorer.
create table if not exists public.hotel_grades (
  hotel_id      uuid primary key references public.hotels(id) on delete cascade,
  cosy_verdict  text not null check (cosy_verdict in ('good','too_high','too_low','unsure')),
  link_ok       boolean,
  ai_score      numeric,   -- snapshot: cosy_scores.score (0..10) at grade time
  ai_confidence text,      -- snapshot: 'low' | 'medium' | 'high'
  note          text,
  grader        text default 'owner',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists hotel_grades_verdict_idx on public.hotel_grades(cosy_verdict);
create index if not exists hotel_grades_linkok_idx on public.hotel_grades(link_ok);

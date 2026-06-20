-- Human cosiness/link labels — the ground-truth eval set behind the cosy score.
-- One row per hotel (latest human verdict wins; re-grading upserts). Captured per grade:
--   cosy_verdict — does the cosy SCORE feel right?  'good' | 'too_high' | 'too_low' | 'unsure'
--   human_score  — when wrong, what YOU would score it 0..10 (turns agreement into a
--                  regression target: correlation + mean error, and a precise calibration anchor)
--   reasons      — quick why-tags (e.g. 'not_cosy','photos_oversell','data_thin','wrong_location',
--                  'gem','corporate') so the scorer can learn specific failure modes
--   link_ok      — is this the RIGHT hotel in the RIGHT city? (null = not assessed)
-- We snapshot the AI score/confidence at grade time so the label stays meaningful after a
-- re-score, and so disagreements feed back as few-shot calibration anchors into the scorer.
create table if not exists public.hotel_grades (
  hotel_id      uuid primary key references public.hotels(id) on delete cascade,
  cosy_verdict  text not null check (cosy_verdict in ('good','too_high','too_low','unsure')),
  human_score   numeric,   -- 0..10, your corrected score (null when verdict='good'/'unsure')
  reasons       text[],
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

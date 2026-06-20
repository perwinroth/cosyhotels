-- Friend cosiness votes — the multi-rater baseline. Distinct from hotel_grades (the owner's
-- richer link+rating labels): this is a simple Tinder-style "cosy / not cosy" swipe, ONE
-- judgement per person per hotel, AI score hidden from the rater so it's an independent vote.
-- Everyone rates the same shared anchor set, so we can measure inter-rater agreement
-- (Krippendorff's α) and build a consensus (% who swiped cosy) per hotel.
create table if not exists public.cosy_votes (
  id         uuid primary key default gen_random_uuid(),
  hotel_id   uuid not null references public.hotels(id) on delete cascade,
  grader     text not null,          -- the rater's name/handle (lowercased)
  vote       boolean not null,       -- true = cosy (swipe right), false = not cosy (swipe left)
  created_at timestamptz default now()
);
-- One vote per rater per hotel (re-swiping updates).
create unique index if not exists cosy_votes_rater_hotel on public.cosy_votes(grader, hotel_id);
create index if not exists cosy_votes_hotel on public.cosy_votes(hotel_id);

-- Owner-only via service role (the /api/vote route writes server-side; public/anon denied).
alter table public.cosy_votes enable row level security;

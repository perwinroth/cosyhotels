-- Per-hotel outreach status (the badge-outreach queue: top-tier hotels we pitch their "Rated Cosy"
-- badge to for editorial backlinks). The LIST is derived live from cosy_scores≥7.0 + a contact
-- channel; this table only persists per-hotel status so the pipeline is editable from the phone.
-- Server-side with the service-role key; RLS on + no policies = deny-all for anon/authenticated.
create table if not exists public.hotel_outreach (
  hotel_id     text primary key,
  status       text not null default 'queued',
  channel      text,
  contacted_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.hotel_outreach enable row level security;

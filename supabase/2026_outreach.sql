-- PR / backlink outreach pipeline — editable from the gated /growth page (phone-friendly).
-- Run once in the Supabase SQL editor. Seeded afterwards from scripts/backups/outreach.json
-- by scripts/seed-outreach.mjs. Accessed server-side with the service-role key (RLS bypassed);
-- RLS is enabled with no public policy so the anon key can never read/write it.
create table if not exists public.outreach (
  id            text primary key,
  outlet        text not null,
  type          text,
  fit           text,
  email         text,
  contact_route text,
  region        text,
  notes         text,
  rec           text,
  status        text not null default 'queued',
  updated_at    timestamptz not null default now()
);

alter table public.outreach enable row level security;
-- (no policies = deny all for anon/authenticated; the server uses the service-role key which bypasses RLS)

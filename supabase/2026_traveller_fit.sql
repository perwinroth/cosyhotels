-- Traveller Fit — per-hotel travel-intent concept assignments (see src/lib/travellerFit.ts).
-- Each row says "hotel X fits concept Y with confidence Z, because of this evidence". Concepts are
-- defined in application code (travellerFit.ts CONCEPTS), so concept_id is a plain text slug here
-- rather than a FK — the taxonomy evolves in code, the table just stores assignments.
-- Written by scripts/infer-traveller-fit.mjs; read by the site (facet/collection pages + hotel
-- "Best for" badges) via the service role only. Idempotent — safe to run repeatedly.
-- Reverse: drop table public.hotel_traveller_fit; (see bottom).

create table if not exists public.hotel_traveller_fit (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  concept_id text not null,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence_text text,
  source text not null default 'llm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (hotel_id, concept_id)
);

-- Collection/facet pages fetch "top hotels for concept Y" — index the (concept, confidence) path.
create index if not exists hotel_traveller_fit_concept_confidence_idx
  on public.hotel_traveller_fit (concept_id, confidence desc);

-- Service-role reads/writes only; enabling RLS with no policies denies anon/authenticated by default.
alter table public.hotel_traveller_fit enable row level security;

-- ── Reversibility ────────────────────────────────────────────────────────────
-- This migration is fully reversible with no data loss to other tables:
--   drop table if exists public.hotel_traveller_fit;
-- (the index and RLS setting are dropped with the table).

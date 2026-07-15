-- Find my collections: magic-link access + marketing consent.
-- Applied separately (founder-run migration); the application code assumes both tables exist.
--
-- email_contacts: best-effort marketing opt-in captured at collection-save time (src/app/api/
-- shortlists/route.ts POST). Consent is only ever upgraded to true there, never silently
-- downgraded back to false by a later save.
create table if not exists public.email_contacts (
  email text primary key,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- collection_access_tokens: short-lived magic-link tokens for "find my collections by email"
-- (src/app/api/collections/request-link/route.ts, src/app/[locale]/collections/view/page.tsx).
-- Only the SHA-256 hash of the token is ever stored (src/lib/savedLists.ts hashToken); the raw
-- token exists only in the emailed link and is never written to the database.
create table if not exists public.collection_access_tokens (
  token_hash text primary key,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists idx_collection_access_tokens_email_created
  on public.collection_access_tokens (email, created_at desc);

alter table public.email_contacts enable row level security;
alter table public.collection_access_tokens enable row level security;
-- Service key bypasses RLS (server-only access via getServerSupabase); no anon policies needed,
-- these tables are never read directly from the client.

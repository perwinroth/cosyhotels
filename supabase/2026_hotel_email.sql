-- Hotel contact email — one publicly-listed contact address per hotel, for 1:1 badge outreach.
-- Populated by scripts/scrape-hotel-emails.ts, which harvests the address a hotel PUBLISHES on its
-- own website (mailto:/contact page) so Per can pitch it a "Cosy Score badge" via Gmail. Legitimate
-- 1:1 business outreach to published business contacts — scoped to the badge-eligible set only
-- (cosy_scores.score_final >= 7 with a hotels.website), NOT bulk harvesting. Read by the growth
-- dashboard / outreach flow via the service role only. Idempotent — safe to run repeatedly.
-- Reverse: drop the 3 columns (see bottom).

alter table public.hotels add column if not exists email text;
-- The exact URL the address was found on (homepage or a contact/impressum page) — provenance so a
-- human can verify the pitch target before sending.
alter table public.hotels add column if not exists email_source text;
-- Set on EVERY scrape attempt, found or not, so re-runs skip already-checked hotels (unless --force).
alter table public.hotels add column if not exists email_checked_at timestamptz;

-- ── Reversibility ────────────────────────────────────────────────────────────
-- Fully reversible with no data loss to other columns:
--   alter table public.hotels drop column if exists email;
--   alter table public.hotels drop column if exists email_source;
--   alter table public.hotels drop column if exists email_checked_at;

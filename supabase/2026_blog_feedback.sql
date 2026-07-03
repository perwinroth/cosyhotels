-- Per-post blog feedback, left from /growth. Blog CONTENT lives in code (src/data/blogPosts.ts), so
-- this is the feedback loop: Per notes what to change per post → Claude applies it → deploy.
-- One row per BLOG_POSTS slug. Server-side with the service-role key; RLS on, no policies = deny-all.
create table if not exists public.blog_feedback (
  slug       text primary key,
  note       text,
  updated_at timestamptz not null default now()
);

alter table public.blog_feedback enable row level security;

-- Blog release schedule: controls which journal posts are publicly visible and when.
-- One row per BLOG_POSTS slug. Visibility rule enforced in src/lib/blogSchedule.ts:
--   visible  ==  status = 'live'  OR  (status = 'scheduled' AND publish_at <= now())
-- Edited from /growth (mirrors the outreach pattern); seeded by scripts/seed-blog-schedule.mjs.
create table if not exists blog_schedule (
  slug        text primary key,
  status      text not null default 'draft' check (status in ('draft','scheduled','live')),
  publish_at  timestamptz,
  updated_at  timestamptz not null default now()
);

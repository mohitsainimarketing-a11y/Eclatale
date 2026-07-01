-- Pending migration (Supabase MCP was unavailable during the build session).
-- Apply via: supabase db execute, the SQL editor, or MCP apply_migration.
-- All features degrade gracefully until this is applied:
--   * intelligence_cache: absence => features run uncached (fresh each call)
--   * notif_* columns: absence => digest treats every user as opted-in

-- 24h cache for AI intelligence payloads (competitor intel, best-time, patterns)
create table if not exists intelligence_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  generated_at timestamptz not null default now(),
  primary key (user_id, kind)
);
alter table intelligence_cache enable row level security;
drop policy if exists "own intelligence cache select" on intelligence_cache;
create policy "own intelligence cache select" on intelligence_cache
  for select using (auth.uid() = user_id);
drop policy if exists "own intelligence cache modify" on intelligence_cache;
create policy "own intelligence cache modify" on intelligence_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Notification preferences (weekly digest opt-in defaults to true)
alter table profiles add column if not exists notif_weekly_digest boolean not null default true;
alter table profiles add column if not exists notif_post_reminders boolean not null default true;
alter table profiles add column if not exists notif_publish_confirm boolean not null default true;

-- ===== Semantic analysis engine (Piece 9) =====

-- Per-post semantic analysis (one row per post; upsert on post_id)
create table if not exists post_analytics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hook_type text,
  hook_strength integer,
  tone_detected text,
  tone_confidence integer,
  sentiment_positive integer,
  sentiment_neutral integer,
  sentiment_negative integer,
  readability_score integer,
  avg_sentence_length integer,
  paragraph_count integer,
  uses_personal_pronouns boolean,
  uses_specific_data boolean,
  has_strong_cta boolean,
  cta_type text,
  jargon_density integer,
  emotional_language integer,
  topic_tags text[],
  estimated_read_time integer,
  unique_angle text,
  created_at timestamptz not null default now()
);
create index if not exists post_analytics_user_idx on post_analytics(user_id);
alter table post_analytics enable row level security;
drop policy if exists "own post_analytics select" on post_analytics;
create policy "own post_analytics select" on post_analytics
  for select using (auth.uid() = user_id);
drop policy if exists "own post_analytics modify" on post_analytics;
create policy "own post_analytics modify" on post_analytics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cached aggregate writing-pattern analysis (one row per user)
create table if not exists user_pattern_cache (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pattern_analysis jsonb,
  posts_analyzed_count integer,
  last_analyzed_at timestamptz,
  next_refresh_at timestamptz
);
alter table user_pattern_cache enable row level security;
drop policy if exists "own user_pattern_cache select" on user_pattern_cache;
create policy "own user_pattern_cache select" on user_pattern_cache
  for select using (auth.uid() = user_id);
drop policy if exists "own user_pattern_cache modify" on user_pattern_cache;
create policy "own user_pattern_cache modify" on user_pattern_cache
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
